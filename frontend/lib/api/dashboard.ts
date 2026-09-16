import { apiClient } from "./client";
import { DashboardSummaryData, DashboardSummaryResponse } from "@/types/dashboard";

/**
 * Dashboard API Service Module
 *
 * Implements the verified SIH26034 backend reporting contract:
 * - GET /api/reports/summary
 *
 * Requires Bearer JWT authentication (automatically injected by apiClient).
 * Backend automatically applies role-scoping:
 * - INSPECTOR: Scoped to inspections created by user and associated violations.
 * - ADMIN / REVIEWER: Scoped globally across the entire system.
 */

/**
 * Fetches compliance and inspection summary statistics for the dashboard.
 *
 * @returns DashboardSummaryData containing inspection counts, compliance evaluation metrics,
 *          and violation breakdown by status and severity.
 */
export async function getDashboardSummaryApi(): Promise<DashboardSummaryData> {
  const response = await apiClient.get<DashboardSummaryResponse>("/reports/summary");
  return response.data.data;
}
