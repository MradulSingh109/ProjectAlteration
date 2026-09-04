import { ComplianceStatus, RoleCode, ValidationStatus, WorkflowStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import { AuthUser } from '../../types/express';
import { RuleSelectorService } from './ruleSelector.service';
import { RuleEvaluatorService } from './ruleEvaluator.service';
import { ViolationService } from './violation.service';
import { ComplianceSummaryResponse } from './types';
import { AuditService } from '../audit.service';

export class RuleEngineService {
  /**
   * Triggers deterministic compliance rule evaluation for an inspection.
   * Atomic Prisma transaction replaces historical results and recalculates overall ComplianceStatus.
   */
  static async validateInspection(
    inspectionId: string,
    user: AuthUser,
    reqCtx?: { ip?: string; userAgent?: string }
  ): Promise<ComplianceSummaryResponse> {
    // 1. Fetch Inspection with Product & Category
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
      include: {
        product: {
          include: {
            category: true,
          },
        },
      },
    });

    if (!inspection) {
      throw AppError.notFound('Inspection not found', 'INSPECTION_NOT_FOUND');
    }

    // 2. RBAC Authorization Checks
    if (user.role === RoleCode.REVIEWER) {
      throw AppError.forbidden(
        'Reviewers are not permitted to trigger compliance evaluation',
        'FORBIDDEN'
      );
    }

    if (user.role === RoleCode.INSPECTOR && inspection.createdBy !== user.id) {
      throw AppError.forbidden(
        'Access denied. Inspectors may only run compliance evaluation for their own inspections.',
        'FORBIDDEN'
      );
    }

    // 3. Workflow Restrictions
    if (inspection.workflowStatus === WorkflowStatus.CANCELLED) {
      throw AppError.validationNotAllowed(
        `Compliance validation cannot be executed on an inspection in CANCELLED status.`
      );
    }

    // 4. Select applicable RuleVersions
    const selectedRules = await RuleSelectorService.selectRulesForInspection(
      inspection.product.categoryId,
      inspection.inspectedAt
    );

    if (selectedRules.length === 0) {
      throw AppError.noApplicableRules(
        `No active compliance rules found for product category '${inspection.product.category.name}' on inspection date.`
      );
    }

    // 5. Fetch extracted declarations
    const declarations = await prisma.declaration.findMany({
      where: { inspectionId },
    });

    // 6. Evaluate each applicable rule
    const evaluationResults = selectedRules.map((rule) =>
      RuleEvaluatorService.evaluateRule(rule, declarations)
    );

    // 7. Calculate overall ComplianceStatus
    let overallStatus: ComplianceStatus = ComplianceStatus.PASS;
    const hasFail = evaluationResults.some((r) => r.status === ValidationStatus.FAIL);
    const hasReview = evaluationResults.some((r) => r.status === ValidationStatus.REVIEW);

    if (hasFail) {
      overallStatus = ComplianceStatus.FAIL;
    } else if (hasReview) {
      overallStatus = ComplianceStatus.REVIEW;
    }

    // 8. Execute atomic transaction to overwrite previous validation results & violations
    const { createdResults, createdViolations } = await prisma.$transaction(async (tx) => {
      // Find existing violations for this inspection to clean up evidences
      const existingViolations = await tx.violation.findMany({
        where: { inspectionId },
        select: { id: true },
      });

      const existingViolationIds = existingViolations.map((v) => v.id);

      if (existingViolationIds.length > 0) {
        await tx.evidence.deleteMany({
          where: { violationId: { in: existingViolationIds } },
        });
      }

      await tx.violation.deleteMany({
        where: { inspectionId },
      });

      await tx.validationResult.deleteMany({
        where: { inspectionId },
      });

      const resList = [];
      const vioList = [];

      for (const evalRes of evaluationResults) {
        // Create ValidationResult
        const valRes = await tx.validationResult.create({
          data: {
            inspectionId,
            ruleVersionId: evalRes.ruleVersionId,
            status: evalRes.status,
            message: evalRes.message,
            confidence: evalRes.confidence || 1.0,
          },
          include: {
            ruleVersion: {
              include: {
                rule: true,
              },
            },
          },
        });
        resList.push(valRes);

        // If evaluation failed, create Violation and linked Evidence
        if (evalRes.status === ValidationStatus.FAIL && evalRes.violationPayload) {
          const vioRecord = ViolationService.buildViolationRecord(
            inspectionId,
            valRes.id,
            evalRes.violationPayload
          );

          const vio = await tx.violation.create({
            data: vioRecord.violationData,
          });
          vioList.push(vio);

          if (vioRecord.evidenceData) {
            await tx.evidence.create({
              data: {
                violationId: vio.id,
                ...vioRecord.evidenceData,
              },
            });
          }
        }
      }

      // Update Inspection complianceStatus
      await tx.inspection.update({
        where: { id: inspectionId },
        data: {
          complianceStatus: overallStatus,
        },
      });

      return { createdResults: resList, createdViolations: vioList };
    });

    // 9. Log Audit Trail
    await AuditService.logAction({
      userId: user.id,
      action: 'COMPLIANCE_VALIDATION_COMPLETED',
      entityType: 'Inspection',
      entityId: inspectionId,
      newValue: {
        inspectionId,
        overallStatus,
        evaluatedRulesCount: evaluationResults.length,
        violationsCount: createdViolations.length,
      },
      ipAddress: reqCtx?.ip,
      userAgent: reqCtx?.userAgent,
    });

    // 10. Construct Summary Response
    return this.formatSummaryResponse(
      inspectionId,
      overallStatus,
      createdResults,
      createdViolations
    );
  }

  /**
   * Retrieves validation results for an inspection with IDOR & RBAC protection.
   */
  static async getValidationResultsByInspection(inspectionId: string, user: AuthUser) {
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
    });

    if (!inspection) {
      throw AppError.notFound('Inspection not found', 'INSPECTION_NOT_FOUND');
    }

    if (user.role === RoleCode.INSPECTOR && inspection.createdBy !== user.id) {
      throw AppError.forbidden(
        'Access denied. Inspectors may only view validation results for their own inspections.',
        'FORBIDDEN'
      );
    }

    const results = await prisma.validationResult.findMany({
      where: { inspectionId },
      include: {
        ruleVersion: {
          include: {
            rule: true,
          },
        },
        violations: true,
      },
      orderBy: { evaluatedAt: 'desc' },
    });

    return results;
  }

  /**
   * Retrieves violations for an inspection with IDOR & RBAC protection.
   */
  static async getViolationsByInspection(inspectionId: string, user: AuthUser) {
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
    });

    if (!inspection) {
      throw AppError.notFound('Inspection not found', 'INSPECTION_NOT_FOUND');
    }

    if (user.role === RoleCode.INSPECTOR && inspection.createdBy !== user.id) {
      throw AppError.forbidden(
        'Access denied. Inspectors may only view violations for their own inspections.',
        'FORBIDDEN'
      );
    }

    const violations = await prisma.violation.findMany({
      where: { inspectionId },
      include: {
        evidences: {
          include: {
            declaration: true,
            image: true,
            ocrResult: true,
          },
        },
        validationResult: {
          include: {
            ruleVersion: {
              include: {
                rule: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return violations;
  }

  /**
   * Retrieves overall compliance summary for an inspection with IDOR & RBAC protection.
   */
  static async getComplianceSummary(
    inspectionId: string,
    user: AuthUser
  ): Promise<ComplianceSummaryResponse> {
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
    });

    if (!inspection) {
      throw AppError.notFound('Inspection not found', 'INSPECTION_NOT_FOUND');
    }

    if (user.role === RoleCode.INSPECTOR && inspection.createdBy !== user.id) {
      throw AppError.forbidden(
        'Access denied. Inspectors may only view compliance summary for their own inspections.',
        'FORBIDDEN'
      );
    }

    const validationResults = await prisma.validationResult.findMany({
      where: { inspectionId },
      include: {
        ruleVersion: {
          include: {
            rule: true,
          },
        },
      },
    });

    const violations = await prisma.violation.findMany({
      where: { inspectionId },
      include: {
        evidences: true,
      },
    });

    return this.formatSummaryResponse(
      inspectionId,
      inspection.complianceStatus,
      validationResults,
      violations
    );
  }

  /**
   * Formats the standardized ComplianceSummaryResponse data structure.
   */
  private static formatSummaryResponse(
    inspectionId: string,
    complianceStatus: ComplianceStatus,
    validationResults: any[],
    violations: any[]
  ): ComplianceSummaryResponse {
    const passedCount = validationResults.filter((r) => r.status === ValidationStatus.PASS).length;
    const failedCount = validationResults.filter((r) => r.status === ValidationStatus.FAIL).length;
    const reviewCount = validationResults.filter((r) => r.status === ValidationStatus.REVIEW).length;
    const notApplicableCount = validationResults.filter(
      (r) => r.status === ValidationStatus.NOT_APPLICABLE
    ).length;

    return {
      inspectionId,
      complianceStatus,
      evaluatedAt: new Date(),
      summary: {
        totalRulesEvaluated: validationResults.length,
        passedCount,
        failedCount,
        reviewCount,
        notApplicableCount,
        violationCount: violations.length,
      },
      validationResults,
      violations,
    };
  }
}
