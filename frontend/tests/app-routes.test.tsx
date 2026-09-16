import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import * as React from "react";
import DashboardPage from "@/app/(app)/dashboard/page";
import InspectionsPage from "@/app/(app)/inspections/page";
import ProductsPage from "@/app/(app)/products/page";
import DeclarationsPage from "@/app/(app)/declarations/page";
import ViolationsPage from "@/app/(app)/violations/page";
import ReviewsPage from "@/app/(app)/reviews/page";
import ReportsPage from "@/app/(app)/reports/page";
import AdminPage from "@/app/(app)/admin/page";
import * as AuthProviderModule from "@/providers/auth-provider";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ replace: vi.fn(), push: vi.fn() })),
  usePathname: vi.fn(() => "/admin"),
}));

vi.mock("@/hooks/use-dashboard", () => ({
  useDashboard: vi.fn(() => ({
    data: {
      inspections: { total: 10, draft: 1, processing: 2, underReview: 1, completed: 6, cancelled: 0 },
      compliance: { pass: 8, fail: 1, review: 1 },
      violations: {
        total: 2,
        open: 1,
        confirmed: 1,
        resolved: 0,
        dismissed: 0,
        bySeverity: { LOW: 0, MEDIUM: 1, HIGH: 1, CRITICAL: 0 },
      },
      generatedAt: "2026-09-17T00:00:00.000Z",
    },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    isFetching: false,
  })),
}));

describe("Authenticated Route Placeholders", () => {
  beforeEach(() => {
    vi.spyOn(AuthProviderModule, "useAuth").mockReturnValue({
      user: {
        id: "admin-1",
        name: "Admin",
        email: "admin@metrology.gov.in",
        role: "ADMIN",
        isActive: true,
        createdAt: "",
        updatedAt: "",
      },
      token: "valid-token",
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
  });

  it("renders Dashboard cleanly", () => {
    render(<DashboardPage />);
    expect(screen.getByRole("heading", { level: 1, name: /(Compliance|System) Dashboard/i })).toBeInTheDocument();
  });

  it("renders Inspections placeholder cleanly", () => {
    render(<InspectionsPage />);
    expect(screen.getByRole("heading", { level: 1, name: /Inspections/i })).toBeInTheDocument();
  });

  it("renders Products placeholder cleanly", () => {
    render(<ProductsPage />);
    expect(screen.getByRole("heading", { level: 1, name: /Products Catalog/i })).toBeInTheDocument();
  });

  it("renders Declarations placeholder cleanly", () => {
    render(<DeclarationsPage />);
    expect(screen.getByRole("heading", { level: 1, name: /Declarations/i })).toBeInTheDocument();
  });

  it("renders Violations placeholder cleanly", () => {
    render(<ViolationsPage />);
    expect(screen.getByRole("heading", { level: 1, name: /Violations Management/i })).toBeInTheDocument();
  });

  it("renders Reviews placeholder for authorized role", () => {
    render(<ReviewsPage />);
    expect(screen.getByRole("heading", { level: 1, name: /Human Adjudication & Reviews/i })).toBeInTheDocument();
  });

  it("renders Reports placeholder cleanly", () => {
    render(<ReportsPage />);
    expect(screen.getByRole("heading", { level: 1, name: /Compliance Reports/i })).toBeInTheDocument();
  });

  it("renders Admin placeholder for ADMIN role", () => {
    render(<AdminPage />);
    expect(screen.getByRole("heading", { level: 1, name: /System Administration/i })).toBeInTheDocument();
  });


  it("blocks non-admin from AdminPage via AuthGuard", () => {
    vi.spyOn(AuthProviderModule, "useAuth").mockReturnValue({
      user: {
        id: "insp-1",
        name: "Inspector",
        email: "inspector@metrology.gov.in",
        role: "INSPECTOR",
        isActive: true,
        createdAt: "",
        updatedAt: "",
      },
      token: "valid-token",
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(<AdminPage />);
    expect(screen.getByText(/Access Restricted/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /System Administration/i })).not.toBeInTheDocument();
  });
});
