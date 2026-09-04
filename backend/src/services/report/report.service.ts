import { RoleCode, ViolationSeverity, ViolationStatus, ReportType, ValidationStatus, ComplianceStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import { AuthUser } from '../../types/express';
import { AuditService } from '../audit.service';
import {
  ComplianceSummaryDTO,
  ComplianceResultDTO,
  InspectionReportDataDTO,
  ReportRecordDTO,
  DashboardSummaryDTO,
  CreateReportInput,
} from './types';

export class ReportService {
  /**
   * Helper: Validates inspection existence and ownership access
   */
  private static async verifyInspectionAccess(inspectionId: string, user: AuthUser) {
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
      select: { id: true, createdBy: true, workflowStatus: true },
    });

    if (!inspection) {
      throw AppError.notFound('Inspection not found', 'INSPECTION_NOT_FOUND');
    }

    if (user.role === RoleCode.INSPECTOR && inspection.createdBy !== user.id) {
      throw AppError.forbidden(
        'Access denied. Inspectors may only access reports and summaries for their own inspections.'
      );
    }

    return inspection;
  }

  /**
   * GET /api/inspections/:id/compliance-summary
   */
  static async getComplianceSummary(
    inspectionId: string,
    user: AuthUser
  ): Promise<ComplianceSummaryDTO> {
    await this.verifyInspectionAccess(inspectionId, user);

    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
      include: {
        product: {
          include: {
            category: { select: { id: true, code: true, name: true } },
          },
        },
        declarations: true,
        validationResults: true,
        violations: {
          include: {
            evidences: true,
          },
        },
      },
    });

    if (!inspection) {
      throw AppError.notFound('Inspection not found', 'INSPECTION_NOT_FOUND');
    }

    // Fetch latest review audit log
    const reviewAuditLog = await prisma.auditLog.findFirst({
      where: {
        entityType: 'Inspection',
        entityId: inspectionId,
        action: { in: ['INSPECTION_REVIEW_COMPLETED', 'VIOLATION_STATUS_CHANGED'] },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    // Declaration summary
    const totalDeclarations = inspection.declarations.length;
    const decByType: Record<string, number> = {};
    const decBySource: Record<string, number> = {};

    for (const dec of inspection.declarations) {
      decByType[dec.type] = (decByType[dec.type] || 0) + 1;
      decBySource[dec.source] = (decBySource[dec.source] || 0) + 1;
    }

    // Validation summary
    let valPass = 0;
    let valFail = 0;
    let valReview = 0;
    let valNA = 0;

    for (const vr of inspection.validationResults) {
      if (vr.status === ValidationStatus.PASS) valPass++;
      else if (vr.status === ValidationStatus.FAIL) valFail++;
      else if (vr.status === ValidationStatus.REVIEW) valReview++;
      else if (vr.status === ValidationStatus.NOT_APPLICABLE) valNA++;
    }

    // Violation summary
    const vioSeverity: Record<ViolationSeverity, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };
    const vioStatus: Record<ViolationStatus, number> = {
      OPEN: 0,
      CONFIRMED: 0,
      DISMISSED: 0,
      RESOLVED: 0,
    };
    let totalEvidences = 0;

    for (const vio of inspection.violations) {
      vioSeverity[vio.severity] = (vioSeverity[vio.severity] || 0) + 1;
      vioStatus[vio.status] = (vioStatus[vio.status] || 0) + 1;
      totalEvidences += vio.evidences.length;
    }

    let reviewDecision: string | null = null;
    let remarks: string | null = inspection.remarks;

    if (reviewAuditLog && reviewAuditLog.newValue) {
      const val = reviewAuditLog.newValue as Record<string, unknown>;
      if (typeof val.decision === 'string') {
        reviewDecision = val.decision;
      }
      if (typeof val.remarks === 'string') {
        remarks = val.remarks;
      }
    }

    return {
      inspection: {
        id: inspection.id,
        inspectionNumber: inspection.inspectionNumber,
        workflowStatus: inspection.workflowStatus,
        complianceStatus: inspection.complianceStatus,
        remarks: inspection.remarks,
        inspectedAt: inspection.inspectedAt,
        completedAt: inspection.completedAt,
        createdAt: inspection.createdAt,
      },
      product: {
        id: inspection.product.id,
        name: inspection.product.name,
        brandName: inspection.product.brandName,
        manufacturerName: inspection.product.manufacturerName,
        category: {
          id: inspection.product.category.id,
          code: inspection.product.category.code,
          name: inspection.product.category.name,
        },
      },
      declarationSummary: {
        total: totalDeclarations,
        byType: decByType,
        bySource: decBySource,
      },
      validationSummary: {
        total: inspection.validationResults.length,
        passCount: valPass,
        failCount: valFail,
        reviewCount: valReview,
        notApplicableCount: valNA,
      },
      violationSummary: {
        total: inspection.violations.length,
        bySeverity: vioSeverity,
        byStatus: vioStatus,
      },
      reviewSummary: {
        latestDecision: reviewDecision,
        reviewedBy: reviewAuditLog?.user
          ? {
              id: reviewAuditLog.user.id,
              name: reviewAuditLog.user.name,
              email: reviewAuditLog.user.email,
            }
          : null,
        reviewedAt: reviewAuditLog ? reviewAuditLog.createdAt : null,
        remarks,
      },
      evidenceReferencesCount: totalEvidences,
    };
  }

  /**
   * GET /api/inspections/:id/compliance-result
   */
  static async getComplianceResult(
    inspectionId: string,
    user: AuthUser
  ): Promise<ComplianceResultDTO> {
    await this.verifyInspectionAccess(inspectionId, user);

    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
      include: {
        validationResults: true,
      },
    });

    if (!inspection) {
      throw AppError.notFound('Inspection not found', 'INSPECTION_NOT_FOUND');
    }

    // Automated evaluation calculation
    let passCount = 0;
    let failCount = 0;
    let reviewCount = 0;
    let latestEvaluatedAt: Date | null = null;

    for (const vr of inspection.validationResults) {
      if (vr.status === ValidationStatus.PASS) passCount++;
      else if (vr.status === ValidationStatus.FAIL) failCount++;
      else if (vr.status === ValidationStatus.REVIEW) reviewCount++;

      if (!latestEvaluatedAt || vr.evaluatedAt > latestEvaluatedAt) {
        latestEvaluatedAt = vr.evaluatedAt;
      }
    }

    let automatedStatus: ComplianceStatus = ComplianceStatus.PASS;
    if (failCount > 0) {
      automatedStatus = ComplianceStatus.FAIL;
    } else if (reviewCount > 0) {
      automatedStatus = ComplianceStatus.REVIEW;
    }

    // Fetch latest review audit log
    const reviewAuditLog = await prisma.auditLog.findFirst({
      where: {
        entityType: 'Inspection',
        entityId: inspectionId,
        action: 'INSPECTION_REVIEW_COMPLETED',
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    let isReviewed = false;
    let latestDecision: string | null = null;
    let remarks: string | null = null;

    if (reviewAuditLog && reviewAuditLog.newValue) {
      isReviewed = true;
      const val = reviewAuditLog.newValue as Record<string, unknown>;
      if (typeof val.decision === 'string') {
        latestDecision = val.decision;
      }
      if (typeof val.remarks === 'string') {
        remarks = val.remarks;
      }
    }

    return {
      inspectionId: inspection.id,
      inspectionNumber: inspection.inspectionNumber,
      automatedEvaluation: {
        complianceStatus: automatedStatus,
        totalRulesEvaluated: inspection.validationResults.length,
        passCount,
        failCount,
        reviewCount,
        evaluatedAt: latestEvaluatedAt,
      },
      humanReview: {
        isReviewed,
        latestDecision,
        reviewedBy: reviewAuditLog?.user
          ? {
              id: reviewAuditLog.user.id,
              name: reviewAuditLog.user.name,
              email: reviewAuditLog.user.email,
            }
          : null,
        reviewedAt: reviewAuditLog ? reviewAuditLog.createdAt : null,
        remarks,
      },
      finalComplianceStatus: inspection.complianceStatus,
      workflowStatus: inspection.workflowStatus,
    };
  }

  /**
   * GET /api/inspections/:id/report
   */
  static async generateReportData(
    inspectionId: string,
    user: AuthUser
  ): Promise<InspectionReportDataDTO> {
    await this.verifyInspectionAccess(inspectionId, user);

    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        product: {
          include: {
            category: { select: { id: true, code: true, name: true } },
          },
        },
        declarations: true,
        images: true,
        validationResults: {
          include: {
            ruleVersion: {
              include: {
                rule: { select: { code: true, name: true, category: true } },
              },
            },
          },
        },
        violations: {
          include: {
            evidences: true,
          },
        },
      },
    });

    if (!inspection) {
      throw AppError.notFound('Inspection not found', 'INSPECTION_NOT_FOUND');
    }

    const complianceResult = await this.getComplianceResult(inspectionId, user);

    const formattedDeclarations = inspection.declarations.map((d) => ({
      id: d.id,
      type: d.type,
      source: d.source,
      rawValue: d.rawValue,
      normalizedValue: d.normalizedValue,
      confidence: d.confidence,
      isHumanReviewed: d.isHumanReviewed,
      correctedValue: d.correctedValue,
      createdAt: d.createdAt,
    }));

    const formattedValidationResults = inspection.validationResults.map((vr) => ({
      id: vr.id,
      ruleCode: vr.ruleVersion.rule.code,
      ruleName: vr.ruleVersion.rule.name,
      ruleCategory: vr.ruleVersion.rule.category,
      requirement: vr.ruleVersion.requirement,
      status: vr.status,
      message: vr.message,
      evaluatedAt: vr.evaluatedAt,
    }));

    const formattedViolations = inspection.violations.map((v) => ({
      id: v.id,
      code: v.code,
      severity: v.severity,
      title: v.title,
      description: v.description,
      status: v.status,
      createdAt: v.createdAt,
      resolvedAt: v.resolvedAt,
      evidences: v.evidences.map((e) => ({
        id: e.id,
        type: e.type,
        referenceId: e.referenceId,
        metadata: e.metadata,
      })),
    }));

    const formattedImages = inspection.images.map((img) => ({
      id: img.id,
      fileUrl: img.fileUrl,
      imageType: img.imageType,
      uploadedAt: img.uploadedAt,
    }));

    return {
      inspection: {
        id: inspection.id,
        inspectionNumber: inspection.inspectionNumber,
        workflowStatus: inspection.workflowStatus,
        complianceStatus: inspection.complianceStatus,
        remarks: inspection.remarks,
        inspectedAt: inspection.inspectedAt,
        completedAt: inspection.completedAt,
        createdAt: inspection.createdAt,
        creator: {
          id: inspection.creator.id,
          name: inspection.creator.name,
          email: inspection.creator.email,
        },
      },
      product: {
        id: inspection.product.id,
        name: inspection.product.name,
        brandName: inspection.product.brandName,
        manufacturerName: inspection.product.manufacturerName,
        category: {
          id: inspection.product.category.id,
          code: inspection.product.category.code,
          name: inspection.product.category.name,
        },
      },
      declarations: formattedDeclarations,
      compliance: complianceResult,
      validationResults: formattedValidationResults,
      violations: formattedViolations,
      evidence: {
        totalImages: inspection.images.length,
        totalEvidences: formattedViolations.reduce((acc, v) => acc + v.evidences.length, 0),
        images: formattedImages,
      },
      review: complianceResult.humanReview,
      generatedAt: new Date(),
    };
  }

  /**
   * POST /api/inspections/:id/reports
   */
  static async createAndPersistReport(
    inspectionId: string,
    user: AuthUser,
    input?: CreateReportInput
  ): Promise<{ report: ReportRecordDTO; reportData: InspectionReportDataDTO }> {
    await this.verifyInspectionAccess(inspectionId, user);

    const reportData = await this.generateReportData(inspectionId, user);

    const reportType = input?.reportType || ReportType.FULL_COMPLIANCE;

    // Create Report record in database
    const createdReport = await prisma.report.create({
      data: {
        inspectionId,
        reportType,
        fileUrl: input?.fileUrl || `/api/inspections/${inspectionId}/report`,
        storageKey: `reports/${inspectionId}/${Date.now()}-${reportType.toLowerCase()}.json`,
        generatedBy: user.id,
      },
      include: {
        generator: { select: { id: true, name: true, email: true } },
      },
    });

    // Log REPORT_GENERATED audit action
    await AuditService.logAction({
      userId: user.id,
      action: 'REPORT_GENERATED',
      entityType: 'Report',
      entityId: createdReport.id,
      newValue: {
        inspectionId,
        reportId: createdReport.id,
        reportType,
        generatedAt: createdReport.generatedAt,
      },
    });

    const reportRecord: ReportRecordDTO = {
      id: createdReport.id,
      inspectionId: createdReport.inspectionId,
      fileUrl: createdReport.fileUrl,
      storageKey: createdReport.storageKey,
      reportType: createdReport.reportType,
      generatedBy: {
        id: createdReport.generator.id,
        name: createdReport.generator.name,
        email: createdReport.generator.email,
      },
      generatedAt: createdReport.generatedAt,
    };

    return {
      report: reportRecord,
      reportData,
    };
  }

  /**
   * GET /api/inspections/:id/reports
   */
  static async listInspectionReports(
    inspectionId: string,
    user: AuthUser
  ): Promise<ReportRecordDTO[]> {
    await this.verifyInspectionAccess(inspectionId, user);

    const reports = await prisma.report.findMany({
      where: { inspectionId },
      orderBy: { generatedAt: 'desc' },
      include: {
        generator: { select: { id: true, name: true, email: true } },
      },
    });

    return reports.map((r) => ({
      id: r.id,
      inspectionId: r.inspectionId,
      fileUrl: r.fileUrl,
      storageKey: r.storageKey,
      reportType: r.reportType,
      generatedBy: {
        id: r.generator.id,
        name: r.generator.name,
        email: r.generator.email,
      },
      generatedAt: r.generatedAt,
    }));
  }

  /**
   * GET /api/inspections/:id/reports/:reportId
   */
  static async getReportById(
    inspectionId: string,
    reportId: string,
    user: AuthUser
  ): Promise<{ report: ReportRecordDTO; reportData: InspectionReportDataDTO }> {
    await this.verifyInspectionAccess(inspectionId, user);

    const report = await prisma.report.findFirst({
      where: {
        id: reportId,
        inspectionId,
      },
      include: {
        generator: { select: { id: true, name: true, email: true } },
      },
    });

    if (!report) {
      throw AppError.reportNotFound(
        'Report record not found or does not belong to specified inspection'
      );
    }

    const reportData = await this.generateReportData(inspectionId, user);

    const reportRecord: ReportRecordDTO = {
      id: report.id,
      inspectionId: report.inspectionId,
      fileUrl: report.fileUrl,
      storageKey: report.storageKey,
      reportType: report.reportType,
      generatedBy: {
        id: report.generator.id,
        name: report.generator.name,
        email: report.generator.email,
      },
      generatedAt: report.generatedAt,
    };

    return {
      report: reportRecord,
      reportData,
    };
  }

  /**
   * GET /api/reports/summary (Compliance Dashboard Summary)
   */
  static async getDashboardSummary(user: AuthUser): Promise<DashboardSummaryDTO> {
    const isInspector = user.role === RoleCode.INSPECTOR;
    const inspectionWhere = isInspector ? { createdBy: user.id } : {};
    const violationWhere = isInspector ? { inspection: { createdBy: user.id } } : {};

    const [
      totalInspections,
      draftInspections,
      processingInspections,
      underReviewInspections,
      completedInspections,
      cancelledInspections,
      passInspections,
      failInspections,
      reviewInspections,
      totalViolations,
      openViolations,
      confirmedViolations,
      resolvedViolations,
      dismissedViolations,
      lowSeverity,
      mediumSeverity,
      highSeverity,
      criticalSeverity,
    ] = await Promise.all([
      prisma.inspection.count({ where: inspectionWhere }),
      prisma.inspection.count({ where: { ...inspectionWhere, workflowStatus: 'DRAFT' } }),
      prisma.inspection.count({ where: { ...inspectionWhere, workflowStatus: 'PROCESSING' } }),
      prisma.inspection.count({ where: { ...inspectionWhere, workflowStatus: 'UNDER_REVIEW' } }),
      prisma.inspection.count({ where: { ...inspectionWhere, workflowStatus: 'COMPLETED' } }),
      prisma.inspection.count({ where: { ...inspectionWhere, workflowStatus: 'CANCELLED' } }),
      prisma.inspection.count({ where: { ...inspectionWhere, complianceStatus: ComplianceStatus.PASS } }),
      prisma.inspection.count({ where: { ...inspectionWhere, complianceStatus: ComplianceStatus.FAIL } }),
      prisma.inspection.count({ where: { ...inspectionWhere, complianceStatus: ComplianceStatus.REVIEW } }),
      prisma.violation.count({ where: violationWhere }),
      prisma.violation.count({ where: { ...violationWhere, status: ViolationStatus.OPEN } }),
      prisma.violation.count({ where: { ...violationWhere, status: ViolationStatus.CONFIRMED } }),
      prisma.violation.count({ where: { ...violationWhere, status: ViolationStatus.RESOLVED } }),
      prisma.violation.count({ where: { ...violationWhere, status: ViolationStatus.DISMISSED } }),
      prisma.violation.count({ where: { ...violationWhere, severity: ViolationSeverity.LOW } }),
      prisma.violation.count({ where: { ...violationWhere, severity: ViolationSeverity.MEDIUM } }),
      prisma.violation.count({ where: { ...violationWhere, severity: ViolationSeverity.HIGH } }),
      prisma.violation.count({ where: { ...violationWhere, severity: ViolationSeverity.CRITICAL } }),
    ]);

    return {
      inspections: {
        total: totalInspections,
        draft: draftInspections,
        processing: processingInspections,
        underReview: underReviewInspections,
        completed: completedInspections,
        cancelled: cancelledInspections,
      },
      compliance: {
        pass: passInspections,
        fail: failInspections,
        review: reviewInspections,
      },
      violations: {
        total: totalViolations,
        open: openViolations,
        confirmed: confirmedViolations,
        resolved: resolvedViolations,
        dismissed: dismissedViolations,
        bySeverity: {
          LOW: lowSeverity,
          MEDIUM: mediumSeverity,
          HIGH: highSeverity,
          CRITICAL: criticalSeverity,
        },
      },
      generatedAt: new Date(),
    };
  }
}
