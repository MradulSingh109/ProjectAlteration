import { describe, it, expect, vi, beforeEach } from "vitest";
import { getDashboardSummaryApi } from "@/lib/api/dashboard";
import { apiClient } from "@/lib/api/client";
import { ApiClientError } from "@/lib/api/errors";
import { DashboardSummaryData } from "@/types/dashboard";

const mockDashboardData: DashboardSummaryData = {
  inspections: {
    total: 24,
    draft: 3,
    processing: 5,
    underReview: 4,
    completed: 11,
    cancelled: 1,
  },
  compliance: {
    pass: 15,
    fail: 5,
    review: 4,
  },
  violations: {
    total: 8,
    open: 4,
    confirmed: 2,
    resolved: 1,
    dismissed: 1,
    bySeverity: {
      LOW: 2,
      MEDIUM: 3,
      HIGH: 2,
      CRITICAL: 1,
    },
  },
  generatedAt: "2026-09-17T03:30:00.000Z",
};

describe("Dashboard API Service Layer", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls GET /reports/summary and returns unwrapped summary data", async () => {
    const getSpy = vi.spyOn(apiClient, "get").mockResolvedValueOnce({
      data: {
        success: true,
        data: mockDashboardData,
        error: null,
      },
    });

    const result = await getDashboardSummaryApi();

    expect(getSpy).toHaveBeenCalledWith("/reports/summary");
    expect(result).toEqual(mockDashboardData);
    expect(result.inspections.total).toBe(24);
    expect(result.compliance.pass).toBe(15);
    expect(result.violations.bySeverity.CRITICAL).toBe(1);
  });

  it("propagates ApiClientError when request fails", async () => {
    vi.spyOn(apiClient, "get").mockRejectedValueOnce(
      new ApiClientError("Failed to fetch reports summary", {
        code: "REPORTS_SUMMARY_FAILED",
        statusCode: 500,
      })
    );

    await expect(getDashboardSummaryApi()).rejects.toThrow(
      "Failed to fetch reports summary"
    );
  });
});
