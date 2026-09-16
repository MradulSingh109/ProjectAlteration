import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import * as React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { MobileNav } from "@/components/layout/mobile-nav";
import * as AuthProviderModule from "@/providers/auth-provider";
import * as NavigationModule from "next/navigation";
import { AuthUser } from "@/types/auth";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
}));

const mockInspectorUser: AuthUser = {
  id: "insp-001",
  name: "Inspector Rajesh",
  email: "rajesh@metrology.gov.in",
  role: "INSPECTOR",
  isActive: true,
  createdAt: "2026-09-17T00:00:00.000Z",
  updatedAt: "2026-09-17T00:00:00.000Z",
};

const mockAdminUser: AuthUser = {
  id: "admin-001",
  name: "Admin Officer",
  email: "admin@metrology.gov.in",
  role: "ADMIN",
  isActive: true,
  createdAt: "2026-09-17T00:00:00.000Z",
  updatedAt: "2026-09-17T00:00:00.000Z",
};

describe("Application Shell & Navigation Components", () => {
  const mockReplace = vi.fn();
  const mockLogout = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(NavigationModule.useRouter).mockReturnValue({
      replace: mockReplace,
      push: vi.fn(),
    } as unknown as ReturnType<typeof NavigationModule.useRouter>);

    vi.mocked(NavigationModule.usePathname).mockReturnValue("/dashboard");

    vi.spyOn(AuthProviderModule, "useAuth").mockReturnValue({
      user: mockInspectorUser,
      token: "mock-token",
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: mockLogout,
    });
  });

  describe("AppSidebar", () => {
    it("renders branding and system modules for INSPECTOR role", () => {
      render(<AppSidebar />);

      expect(screen.getAllByText("SIH26034").length).toBeGreaterThan(0);
      expect(screen.getByText("Dashboard")).toBeInTheDocument();
      expect(screen.getByText("Inspections")).toBeInTheDocument();
      expect(screen.getByText("Products")).toBeInTheDocument();
      expect(screen.getByText("Declarations")).toBeInTheDocument();
      expect(screen.getByText("Violations")).toBeInTheDocument();
      expect(screen.getByText("Reports")).toBeInTheDocument();

      // Restricted items must be hidden for INSPECTOR
      expect(screen.queryByText("Reviews")).not.toBeInTheDocument();
      expect(screen.queryByText("Administration")).not.toBeInTheDocument();
    });

    it("renders all modules including Administration for ADMIN role", () => {
      vi.spyOn(AuthProviderModule, "useAuth").mockReturnValue({
        user: mockAdminUser,
        token: "mock-token",
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: mockLogout,
      });

      render(<AppSidebar />);

      expect(screen.getByText("Reviews")).toBeInTheDocument();
      expect(screen.getByText("Administration")).toBeInTheDocument();
    });

    it("marks the active route with aria-current='page'", () => {
      vi.mocked(NavigationModule.usePathname).mockReturnValue("/inspections");
      render(<AppSidebar />);

      const activeLink = screen.getByRole("link", { name: /Inspections/i });
      expect(activeLink).toHaveAttribute("aria-current", "page");

      const inactiveLink = screen.getByRole("link", { name: /Dashboard/i });
      expect(inactiveLink).not.toHaveAttribute("aria-current");
    });
  });

  describe("AppHeader & User Menu", () => {
    it("renders user information and triggers logout when requested", async () => {
      render(<AppHeader onOpenMobileNav={vi.fn()} />);

      // Opens user menu
      const userButton = screen.getByRole("button", {
        name: /User account menu/i,
      });
      fireEvent.click(userButton);

      expect(screen.getAllByText("rajesh@metrology.gov.in").length).toBeGreaterThan(0);

      // Click sign out
      const signOutButton = screen.getByRole("menuitem", { name: /Sign Out/i });
      fireEvent.click(signOutButton);

      expect(mockLogout).toHaveBeenCalled();
    });

    it("calls onOpenMobileNav when hamburger menu button is clicked", () => {
      const onOpenMock = vi.fn();
      render(<AppHeader onOpenMobileNav={onOpenMock} />);

      const mobileButton = screen.getByLabelText(/Open navigation menu/i);
      fireEvent.click(mobileButton);

      expect(onOpenMock).toHaveBeenCalled();
    });
  });

  describe("MobileNav", () => {
    it("renders navigation dialog when isOpen is true", () => {
      const onCloseMock = vi.fn();
      render(<MobileNav isOpen={true} onClose={onCloseMock} />);

      const dialog = screen.getByRole("dialog", {
        name: /Mobile Navigation Menu/i,
      });
      expect(dialog).toBeInTheDocument();

      const closeButton = screen.getByLabelText(/Close navigation menu/i);
      fireEvent.click(closeButton);

      expect(onCloseMock).toHaveBeenCalled();
    });

    it("does not render when isOpen is false", () => {
      render(<MobileNav isOpen={false} onClose={vi.fn()} />);
      expect(
        screen.queryByRole("dialog", { name: /Mobile Navigation Menu/i })
      ).not.toBeInTheDocument();
    });
  });

  describe("AppShell Master Layout", () => {
    it("renders children in the main content container", () => {
      render(
        <AppShell>
          <div data-testid="test-content">Authenticated Content</div>
        </AppShell>
      );

      expect(screen.getByTestId("test-content")).toBeInTheDocument();
    });
  });
});
