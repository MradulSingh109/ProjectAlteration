import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useDashboard } from "@/hooks/use-dashboard";
import * as DashboardApiModule from "@/lib/api/dashboard";
import * as AuthProviderModule from "@/providers/auth-provider";
import { DashboardSummaryData } from "@/types/dashboard";
import { ApiClientError } from "@/lib/api/errors";

const mockSummaryData: DashboardSummaryData = {
  inspections: {
    total: 30,
    draft: 2,
    processing: 4,
    underReview: 4,
    completed: 20,
    cancelled: 0,
  },
  compliance: {
    pass: 22,
    fail: 4,
    review: 4,
  },
  violations: {
    total: 5,
    open: 2,
    confirmed: 2,
    resolved: 1,
    dismissed: 0,
    bySeverity: {
      LOW: 1,
      MEDIUM: 2,
      HIGH: 1,
      CRITICAL: 1,
    },
  },
  generatedAt: "2026-09-17T03:00:00.000Z",
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("useDashboard hook", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches and returns dashboard summary data when user is authenticated", async () => {
    vi.spyOn(AuthProviderModule, "useAuth").mockReturnValue({
      user: {
        id: "insp-1",
        email: "inspector@gov.in",
        name: "Officer",
        role: "INSPECTOR",
        isActive: true,
        createdAt: "",
        updatedAt: "",
      },
      token: "token-123",
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    const getSpy = vi
      .spyOn(DashboardApiModule, "getDashboardSummaryApi")
      .mockResolvedValueOnce(mockSummaryData);

    const { result } = renderHook(() => useDashboard(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(mockSummaryData);
    expect(result.current.data?.inspections.total).toBe(30);
  });

  it("handles error state properly when API call fails", async () => {
    vi.spyOn(AuthProviderModule, "useAuth").mockReturnValue({
      user: {
        id: "admin-1",
        email: "admin@gov.in",
        name: "Admin",
        role: "ADMIN",
        isActive: true,
        createdAt: "",
        updatedAt: "",
      },
      token: "token-123",
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    vi.spyOn(DashboardApiModule, "getDashboardSummaryApi").mockRejectedValueOnce(
      new ApiClientError("Failed to fetch summary data", {
        code: "INTERNAL_ERROR",
        statusCode: 500,
      })
    );

    const { result } = renderHook(() => useDashboard(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(ApiClientError);
    expect(result.current.error?.message).toBe("Failed to fetch summary data");
  });

  it("does not trigger query fetch when user is not authenticated", () => {
    vi.spyOn(AuthProviderModule, "useAuth").mockReturnValue({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    const getSpy = vi.spyOn(DashboardApiModule, "getDashboardSummaryApi");

    const { result } = renderHook(() => useDashboard(), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(getSpy).not.toHaveBeenCalled();
  });
});
