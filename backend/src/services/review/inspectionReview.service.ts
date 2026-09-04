import { ComplianceStatus, RoleCode, ViolationStatus, WorkflowStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import { AuthUser } from '../../types/express';
import { ReviewInspectionInput, ReviewActionResult } from './types';
import { AuditService } from '../audit.service';

export class InspectionReviewService {
  /**
   * Retrieves validation results for an inspection with RBAC scoping.
   */
  static async listValidationResults(inspectionId: string, user: AuthUser) {
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
        violations: {
          include: {
            evidences: true,
          },
        },
      },
      orderBy: { evaluatedAt: 'desc' },
    });

    return results;
  }

  /**
   * Retrieves a single validation result with cross-inspection validation and RBAC scoping.
   */
  static async getValidationResultById(
    inspectionId: string,
    validationResultId: string,
    user: AuthUser
  ) {
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

    const result = await prisma.validationResult.findUnique({
      where: { id: validationResultId },
      include: {
        ruleVersion: {
          include: {
            rule: true,
          },
        },
        violations: {
          include: {
            evidences: true,
          },
        },
      },
    });

    if (!result || result.inspectionId !== inspectionId) {
      throw AppError.validationResultNotFound(
        'Validation result not found or does not belong to specified inspection'
      );
    }

    return result;
  }

  /**
   * Submits a reviewer's human review decision on an inspection in UNDER_REVIEW status.
   */
  static async completeInspectionReview(
    inspectionId: string,
    input: ReviewInspectionInput,
    user: AuthUser,
    reqCtx?: { ip?: string; userAgent?: string }
  ): Promise<ReviewActionResult> {
    // 1. RBAC authorization (Only ADMIN and REVIEWER can submit review decisions)
    if (user.role === RoleCode.INSPECTOR) {
      throw AppError.forbidden(
        'Inspectors are not permitted to complete human inspection reviews',
        'FORBIDDEN'
      );
    }

    // 2. Fetch Inspection
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
    });

    if (!inspection) {
      throw AppError.notFound('Inspection not found', 'INSPECTION_NOT_FOUND');
    }

    // 3. Workflow State Verification (Must be UNDER_REVIEW)
    if (inspection.workflowStatus !== WorkflowStatus.UNDER_REVIEW) {
      throw AppError.invalidWorkflowState(
        `Inspection review can only be completed for inspections in 'UNDER_REVIEW' status. Current status: '${inspection.workflowStatus}'`
      );
    }

    // 4. Fetch Violations for unresolved violation check
    const violations = await prisma.violation.findMany({
      where: { inspectionId },
    });

    const previousWorkflowStatus = inspection.workflowStatus;
    const previousComplianceStatus = inspection.complianceStatus;

    let newWorkflowStatus: WorkflowStatus = inspection.workflowStatus;
    let newComplianceStatus: ComplianceStatus = inspection.complianceStatus;
    let completedAt: Date | null = null;

    // 5. Evaluate Review Decision
    if (input.decision === 'APPROVE') {
      const openViolations = violations.filter((v) => v.status === ViolationStatus.OPEN);
      if (openViolations.length > 0) {
        throw AppError.unresolvedViolationsRemain(
          `Cannot approve inspection review while ${openViolations.length} open violation(s) remain unresolved. Please confirm, resolve, or dismiss all open violations before approval.`
        );
      }

      // Check if any violations are confirmed (if confirmed -> FAIL, else if resolved/dismissed/none -> PASS)
      const confirmedViolations = violations.filter((v) => v.status === ViolationStatus.CONFIRMED);
      newComplianceStatus = confirmedViolations.length > 0 ? ComplianceStatus.FAIL : ComplianceStatus.PASS;

      newWorkflowStatus = WorkflowStatus.COMPLETED;
      completedAt = new Date();
    } else if (input.decision === 'REJECT') {
      newWorkflowStatus = WorkflowStatus.CANCELLED;
      newComplianceStatus = ComplianceStatus.FAIL;
    } else if (input.decision === 'REQUEST_CHANGES') {
      newWorkflowStatus = WorkflowStatus.DRAFT;
    }

    // 6. Update Inspection Record in DB
    const updatedInspection = await prisma.inspection.update({
      where: { id: inspectionId },
      data: {
        workflowStatus: newWorkflowStatus,
        complianceStatus: newComplianceStatus,
        completedAt,
        ...(input.comments && { remarks: input.comments }),
      },
    });

    // 7. Audit Log
    await AuditService.logAction({
      userId: user.id,
      action: 'INSPECTION_REVIEW_COMPLETED',
      entityType: 'Inspection',
      entityId: inspectionId,
      oldValue: {
        workflowStatus: previousWorkflowStatus,
        complianceStatus: previousComplianceStatus,
      },
      newValue: {
        decision: input.decision,
        workflowStatus: updatedInspection.workflowStatus,
        complianceStatus: updatedInspection.complianceStatus,
        comments: input.comments || null,
        reviewedBy: user.id,
      },
      ipAddress: reqCtx?.ip,
      userAgent: reqCtx?.userAgent,
    });

    return {
      inspectionId,
      previousWorkflowStatus,
      newWorkflowStatus: updatedInspection.workflowStatus,
      previousComplianceStatus,
      newComplianceStatus: updatedInspection.complianceStatus,
      decision: input.decision,
      comments: input.comments,
      reviewedBy: user.id,
      reviewedAt: new Date(),
    };
  }
}
