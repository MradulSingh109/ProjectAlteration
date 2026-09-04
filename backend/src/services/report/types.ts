import { z } from 'zod';
import { ComplianceStatus, WorkflowStatus, ViolationSeverity, ViolationStatus, ReportType } from '@prisma/client';

export const createReportSchema = z.object({
  reportType: z.nativeEnum(ReportType).optional().default(ReportType.FULL_COMPLIANCE),
  fileUrl: z.string().url().optional(),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;

export interface ComplianceSummaryDTO {
  inspection: {
    id: string;
    inspectionNumber: string;
    workflowStatus: WorkflowStatus;
    complianceStatus: ComplianceStatus;
    remarks: string | null;
    inspectedAt: Date;
    completedAt: Date | null;
    createdAt: Date;
  };
  product: {
    id: string;
    name: string;
    brandName: string;
    manufacturerName: string;
    category: {
      id: string;
      code: string;
      name: string;
    };
  };
  declarationSummary: {
    total: number;
    byType: Record<string, number>;
    bySource: Record<string, number>;
  };
  validationSummary: {
    total: number;
    passCount: number;
    failCount: number;
    reviewCount: number;
    notApplicableCount: number;
  };
  violationSummary: {
    total: number;
    bySeverity: Record<ViolationSeverity, number>;
    byStatus: Record<ViolationStatus, number>;
  };
  reviewSummary: {
    latestDecision: string | null;
    reviewedBy: {
      id: string;
      name: string;
      email: string;
    } | null;
    reviewedAt: Date | null;
    remarks: string | null;
  };
  evidenceReferencesCount: number;
}

export interface ComplianceResultDTO {
  inspectionId: string;
  inspectionNumber: string;
  automatedEvaluation: {
    complianceStatus: ComplianceStatus;
    totalRulesEvaluated: number;
    passCount: number;
    failCount: number;
    reviewCount: number;
    evaluatedAt: Date | null;
  };
  humanReview: {
    isReviewed: boolean;
    latestDecision: string | null;
    reviewedBy: {
      id: string;
      name: string;
      email: string;
    } | null;
    reviewedAt: Date | null;
    remarks: string | null;
  };
  finalComplianceStatus: ComplianceStatus;
  workflowStatus: WorkflowStatus;
}

export interface InspectionReportDataDTO {
  inspection: {
    id: string;
    inspectionNumber: string;
    workflowStatus: WorkflowStatus;
    complianceStatus: ComplianceStatus;
    remarks: string | null;
    inspectedAt: Date;
    completedAt: Date | null;
    createdAt: Date;
    creator: {
      id: string;
      name: string;
      email: string;
    };
  };
  product: {
    id: string;
    name: string;
    brandName: string;
    manufacturerName: string;
    category: {
      id: string;
      code: string;
      name: string;
    };
  };
  declarations: Array<{
    id: string;
    type: string;
    source: string;
    rawValue: string;
    normalizedValue: string | null;
    confidence: number | null;
    isHumanReviewed: boolean;
    correctedValue: string | null;
    createdAt: Date;
  }>;
  compliance: ComplianceResultDTO;
  validationResults: Array<{
    id: string;
    ruleCode: string;
    ruleName: string;
    ruleCategory: string;
    requirement: string;
    status: string;
    message: string;
    evaluatedAt: Date;
  }>;
  violations: Array<{
    id: string;
    code: string;
    severity: ViolationSeverity;
    title: string;
    description: string;
    status: ViolationStatus;
    createdAt: Date;
    resolvedAt: Date | null;
    evidences: Array<{
      id: string;
      type: string;
      referenceId: string | null;
      metadata: unknown;
    }>;
  }>;
  evidence: {
    totalImages: number;
    totalEvidences: number;
    images: Array<{
      id: string;
      fileUrl: string;
      imageType: string;
      uploadedAt: Date;
    }>;
  };
  review: {
    isReviewed: boolean;
    latestDecision: string | null;
    reviewedBy: {
      id: string;
      name: string;
      email: string;
    } | null;
    reviewedAt: Date | null;
    remarks: string | null;
  };
  generatedAt: Date;
}

export interface ReportRecordDTO {
  id: string;
  inspectionId: string;
  fileUrl: string;
  storageKey: string;
  reportType: ReportType;
  generatedBy: {
    id: string;
    name: string;
    email: string;
  };
  generatedAt: Date;
}

export interface DashboardSummaryDTO {
  inspections: {
    total: number;
    draft: number;
    processing: number;
    underReview: number;
    completed: number;
    cancelled: number;
  };
  compliance: {
    pass: number;
    fail: number;
    review: number;
  };
  violations: {
    total: number;
    open: number;
    confirmed: number;
    resolved: number;
    dismissed: number;
    bySeverity: Record<ViolationSeverity, number>;
  };
  generatedAt: Date;
}
