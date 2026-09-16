"use client";

import * as React from "react";
import { RefreshCw, AlertCircle, ShieldAlert, Globe, UserCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { useAuth } from "@/providers/auth-provider";
import { useDashboard } from "@/hooks/use-dashboard";
import { DashboardSummaryCards } from "@/components/dashboard/dashboard-summary-cards";
import { ComplianceChart } from "@/components/dashboard/compliance-chart";
import { InspectionPipelineChart } from "@/components/dashboard/inspection-pipeline-chart";
import { ViolationSeverityCards } from "@/components/dashboard/violation-severity-cards";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, isError, error, refetch, isFetching } = useDashboard();

  const isInspector = user?.role === "INSPECTOR";
  const scopeLabel = isInspector
    ? "Showing your assigned inspections and findings"
    : "Showing organization-wide compliance metrics";

  const isEmpty =
    !isLoading &&
    !isError &&
    data &&
    data.inspections.total === 0 &&
    data.violations.total === 0;

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      {/* Header with Title, Role Scoping Info, and Refresh Action */}
      <PageHeader
        heading="Compliance Dashboard"
        subheading="Central executive overview and legal metrology inspection metrics."
      >
        <div className="flex flex-wrap items-center gap-3">
          {/* Role Scoping Badge */}
          <div
            className="flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs text-muted-foreground"
            data-testid="role-scope-indicator"
          >
            {isInspector ? (
              <UserCheck className="h-3.5 w-3.5 text-blue-500" />
            ) : (
              <Globe className="h-3.5 w-3.5 text-emerald-500" />
            )}
            <span className="font-medium text-foreground">
              {isInspector ? "Inspector Scope" : "System-wide Scope"}:
            </span>
            <span>{scopeLabel}</span>
          </div>

          {/* Refresh Query Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2"
            data-testid="refresh-dashboard-btn"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
            />
            <span>{isFetching ? "Refreshing..." : "Refresh"}</span>
          </Button>
        </div>
      </PageHeader>

      {/* Loading Skeleton */}
      {isLoading && <DashboardSkeleton />}

      {/* Error State with Retry Action */}
      {isError && !isLoading && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900/50 dark:bg-red-950/30"
          data-testid="dashboard-error"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-red-900 dark:text-red-200">
                Failed to load compliance statistics
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300">
                {error?.message ||
                  "An unexpected error occurred while communicating with the backend reporting service."}
              </p>
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  className="border-red-300 bg-white text-red-700 hover:bg-red-50 dark:border-red-800 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900"
                >
                  Retry Loading
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {isEmpty && (
        <EmptyState
          icon={ShieldAlert}
          title="No Compliance Data Recorded"
          description="No inspection workflows or violation findings have been registered in this scope yet."
          action={
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Refresh Feed
            </Button>
          }
          data-testid="dashboard-empty-state"
        />
      )}

      {/* Populated Dashboard Content */}
      {!isLoading && !isError && data && !isEmpty && (
        <div className="space-y-6">
          {/* Pillar 1: 4 Key Metric Cards */}
          <DashboardSummaryCards data={data} />

          {/* Pillar 2: Visualizations (Compliance Distribution & Pipeline) */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ComplianceChart compliance={data.compliance} />
            <InspectionPipelineChart inspections={data.inspections} />
          </div>

          {/* Pillar 3: Violation Severity Breakdown */}
          <ViolationSeverityCards violations={data.violations} />

          {/* Metadata Footer */}
          {data.generatedAt && (
            <div className="flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
              <span>
                Report generated at: {new Date(data.generatedAt).toLocaleString()}
              </span>
              <span>Backend Contract: GET /api/reports/summary</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
