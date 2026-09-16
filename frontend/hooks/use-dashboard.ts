"use client";

import { useQuery } from "@tanstack/react-query";
import { getDashboardSummaryApi } from "@/lib/api/dashboard";
import { DashboardSummaryData } from "@/types/dashboard";
import { useAuth } from "@/providers/auth-provider";
import { ApiClientError } from "@/lib/api/errors";

export const DASHBOARD_QUERY_KEY = ["dashboard", "summary"] as const;

/**
 * Custom hook for fetching and caching dashboard compliance summary statistics.
 *
 * Automatically refetches on manual trigger and guards execution
 * based on authenticated session state.
 */
export function useDashboard() {
  const { isAuthenticated } = useAuth();

  return useQuery<DashboardSummaryData, ApiClientError>({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: () => getDashboardSummaryApi(),
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });
}
