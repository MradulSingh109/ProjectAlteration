import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import * as React from "react";
import DashboardPage from "@/app/(app)/dashboard/page";
import * as UseDashboardModule from "@/hooks/use-dashboard";
import * as AuthProviderModule from "@/providers/auth-provider";
import { DashboardSummaryData } from "@/types/dashboard";
import { ApiClientError } from "@/lib/api/errors";

const mockSummaryData: DashboardSummaryData = {
  inspections: {
    total: 48,
    draft: 4,
    processing: 8,
    underReview: 6,
    completed: 30,
    cancelled: 0,
  },
  compliance: {
    pass: 36,
    fail: 6,
    review: 6,
  },
  violations: {
    total: 12,
    open: 5,
    confirmed: 4,
    resolved: 2,
    dismissed: 1,
    bySeverity: {
      LOW: 3,
      MEDIUM: 4,
      HIGH: 3,
      CRITICAL: 2,
    },
  },
  generatedAt: "2026-09-17T03:45:00.000Z",
};

describe("DashboardPage Component", () => {
  const mockRefetch = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    mockRefetch.mockClear();
  });

  describe("Loading State", () => {
    it("renders dashboard skeleton loader while query is loading", () => {
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
        token: "tok",
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
      });

      vi.spyOn(UseDashboardModule, "useDashboard").mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
        refetch: mockRefetch,
        isFetching: false,
      } as unknown as ReturnType<typeof UseDashboardModule.useDashboard>);

      render(<DashboardPage />);

      expect(screen.getByTestId("dashboard-skeleton")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /Compliance Dashboard/i })).toBeInTheDocument();
    });
  });

  describe("Error State", () => {
    it("renders error banner and retry button when query fails", () => {
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
        token: "tok",
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
      });

      vi.spyOn(UseDashboardModule, "useDashboard").mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new ApiClientError("Server connectivity timeout", {
          code: "TIMEOUT",
          statusCode: 504,
        }),
        refetch: mockRefetch,
        isFetching: false,
      } as unknown as ReturnType<typeof UseDashboardModule.useDashboard>);

      render(<DashboardPage />);

      expect(screen.getByTestId("dashboard-error")).toBeInTheDocument();
      expect(
        screen.getByText(/Failed to load compliance statistics/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/Server connectivity timeout/i)).toBeInTheDocument();

      const retryBtn = screen.getByRole("button", { name: /Retry Loading/i });
      fireEvent.click(retryBtn);
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("Empty State", () => {
    it("renders empty state when there are zero inspections and zero violations", () => {
      vi.spyOn(AuthProviderModule, "useAuth").mockReturnValue({
        user: {
          id: "insp-1",
          email: "inspector@gov.in",
          name: "Inspector",
          role: "INSPECTOR",
          isActive: true,
          createdAt: "",
          updatedAt: "",
        },
        token: "tok",
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
      });

      vi.spyOn(UseDashboardModule, "useDashboard").mockReturnValue({
        data: {
          inspections: {
            total: 0,
            draft: 0,
            processing: 0,
            underReview: 0,
            completed: 0,
            cancelled: 0,
          },
          compliance: { pass: 0, fail: 0, review: 0 },
          violations: {
            total: 0,
            open: 0,
            confirmed: 0,
            resolved: 0,
            dismissed: 0,
            bySeverity: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
          },
          generatedAt: "2026-09-17T03:00:00.000Z",
        },
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
        isFetching: false,
      } as unknown as ReturnType<typeof UseDashboardModule.useDashboard>);

      render(<DashboardPage />);

      expect(screen.getByTestId("dashboard-empty-state")).toBeInTheDocument();
      expect(
        screen.getByText(/No Compliance Data Recorded/i)
      ).toBeInTheDocument();
    });
  });

  describe("Populated Dashboard Content", () => {
    it("renders full dashboard with cards, charts, and severity breakdowns for ADMIN", () => {
      vi.spyOn(AuthProviderModule, "useAuth").mockReturnValue({
        user: {
          id: "admin-1",
          email: "admin@gov.in",
          name: "Admin User",
          role: "ADMIN",
          isActive: true,
          createdAt: "",
          updatedAt: "",
        },
        token: "tok",
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
      });

      vi.spyOn(UseDashboardModule, "useDashboard").mockReturnValue({
        data: mockSummaryData,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
        isFetching: false,
      } as unknown as ReturnType<typeof UseDashboardModule.useDashboard>);

      render(<DashboardPage />);

      // Check Heading
      expect(
        screen.getByRole("heading", { level: 1, name: /Compliance Dashboard/i })
      ).toBeInTheDocument();

      // Check System-wide Scope Indicator for ADMIN
      const scopeIndicator = screen.getByTestId("role-scope-indicator");
      expect(scopeIndicator).toHaveTextContent("System-wide Scope");
      expect(scopeIndicator).toHaveTextContent(
        "Showing organization-wide compliance metrics"
      );

      // Check 4 Pillar Summary Cards
      expect(screen.getByTestId("card-total-inspections")).toHaveTextContent("48");
      expect(screen.getByTestId("card-compliant-packages")).toHaveTextContent("36");
      expect(screen.getByTestId("card-detected-violations")).toHaveTextContent("12");
      expect(screen.getByTestId("card-pending-reviews")).toHaveTextContent("6");

      // Check Visualizations
      expect(screen.getByTestId("compliance-chart-card")).toBeInTheDocument();
      expect(screen.getByTestId("inspection-pipeline-card")).toBeInTheDocument();

      // Check Severity Cards
      expect(screen.getByTestId("severity-card-critical")).toHaveTextContent("2");
      expect(screen.getByTestId("severity-card-high")).toHaveTextContent("3");
      expect(screen.getByTestId("severity-card-medium")).toHaveTextContent("4");
      expect(screen.getByTestId("severity-card-low")).toHaveTextContent("3");

      // Check Refresh Button
      const refreshBtn = screen.getByTestId("refresh-dashboard-btn");
      expect(refreshBtn).toBeInTheDocument();
      fireEvent.click(refreshBtn);
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });

    it("renders Inspector scope indicator when authenticated as INSPECTOR", () => {
      vi.spyOn(AuthProviderModule, "useAuth").mockReturnValue({
        user: {
          id: "insp-1",
          email: "inspector@gov.in",
          name: "Field Officer",
          role: "INSPECTOR",
          isActive: true,
          createdAt: "",
          updatedAt: "",
        },
        token: "tok",
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
      });

      vi.spyOn(UseDashboardModule, "useDashboard").mockReturnValue({
        data: mockSummaryData,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
        isFetching: false,
      } as unknown as ReturnType<typeof UseDashboardModule.useDashboard>);

      render(<DashboardPage />);

      const scopeIndicator = screen.getByTestId("role-scope-indicator");
      expect(scopeIndicator).toHaveTextContent("Inspector Scope");
      expect(scopeIndicator).toHaveTextContent(
        "Showing your assigned inspections and findings"
      );
    });
  });
});
