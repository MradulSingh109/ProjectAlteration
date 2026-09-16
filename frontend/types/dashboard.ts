import { ApiResponse } from "@/lib/api/types";

/**
 * Violation severity levels defined by the backend Prisma schema.
 */
export type ViolationSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/**
 * Inspection workflow status metrics returned by GET /api/reports/summary
 */
export interface InspectionMetrics {
  total: number;
  draft: number;
  processing: number;
  underReview: number;
  completed: number;
  cancelled: number;
}

/**
 * Automated and human review compliance evaluation metrics
 */
export interface ComplianceMetrics {
  pass: number;
  fail: number;
  review: number;
}

/**
 * Detected violations metrics and breakdown by status and severity
 */
export interface ViolationMetrics {
  total: number;
  open: number;
  confirmed: number;
  resolved: number;
  dismissed: number;
  bySeverity: Record<ViolationSeverity, number>;
}

/**
 * Dashboard aggregate summary payload returned inside the data field of GET /api/reports/summary
 */
export interface DashboardSummaryData {
  inspections: InspectionMetrics;
  compliance: ComplianceMetrics;
  violations: ViolationMetrics;
  generatedAt: string;
}

/**
 * API response envelope for dashboard summary
 */
export type DashboardSummaryResponse = ApiResponse<DashboardSummaryData>;
