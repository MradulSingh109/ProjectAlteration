import { ValidationStatus, ViolationSeverity, ComplianceStatus } from '@prisma/client';

export interface RuleConfig {
  field?: string;
  declarationType?: string;
  mustExist?: boolean;
  currency?: string;
  allowedFormats?: string[];
  maxAllowed?: number;
  minAllowed?: number;
  expectedPattern?: string;
  severity?: ViolationSeverity;
  [key: string]: unknown;
}

export interface SelectedRule {
  ruleId: string;
  ruleVersionId: string;
  ruleCode: string;
  ruleName: string;
  category: string;
  version: number;
  validationType: string;
  requirement: string;
  configuration: RuleConfig | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

export interface ViolationPayload {
  code: string;
  severity: ViolationSeverity;
  title: string;
  description: string;
  declarationId?: string;
}

export interface RuleEvaluationResult {
  ruleId: string;
  ruleVersionId: string;
  status: ValidationStatus;
  message: string;
  confidence?: number;
  declarationIds: string[];
  evidenceIds?: string[];
  violationPayload?: ViolationPayload;
}

export interface ComplianceSummaryResponse {
  inspectionId: string;
  complianceStatus: ComplianceStatus;
  evaluatedAt: Date;
  summary: {
    totalRulesEvaluated: number;
    passedCount: number;
    failedCount: number;
    reviewCount: number;
    notApplicableCount: number;
    violationCount: number;
  };
  validationResults: any[];
  violations: any[];
}
