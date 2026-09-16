import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import * as React from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import * as AuthProviderModule from "@/providers/auth-provider";
import * as NavigationModule from "next/navigation";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
}));

describe("AuthGuard Protected Route Component", () => {
  const mockReplace = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(NavigationModule.useRouter).mockReturnValue({
      replace: mockReplace,
    } as unknown as ReturnType<typeof NavigationModule.useRouter>);
    vi.mocked(NavigationModule.usePathname).mockReturnValue("/verify-session");
  });

  it("renders loading indicator when session status is loading", () => {
    vi.spyOn(AuthProviderModule, "useAuth").mockReturnValue({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <AuthGuard>
        <div data-testid="protected-content">Secret Content</div>
      </AuthGuard>
    );

    expect(
      screen.getByText(/Verifying security session/i)
    ).toBeInTheDocument();
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
  });

  it("redirects unauthenticated user to login with redirect param", () => {
    vi.spyOn(AuthProviderModule, "useAuth").mockReturnValue({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <AuthGuard>
        <div data-testid="protected-content">Secret Content</div>
      </AuthGuard>
    );

    expect(mockReplace).toHaveBeenCalledWith(
      "/login?redirect=%2Fverify-session"
    );
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
  });

  it("renders protected content when user is authenticated", () => {
    vi.spyOn(AuthProviderModule, "useAuth").mockReturnValue({
      user: {
        id: "1",
        name: "Inspector",
        email: "test@example.com",
        role: "INSPECTOR",
        isActive: true,
        createdAt: "",
        updatedAt: "",
      },
      token: "valid-jwt",
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <AuthGuard>
        <div data-testid="protected-content">Secret Content</div>
      </AuthGuard>
    );

    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
    expect(screen.getByText("Secret Content")).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("shows access restricted when user role is not in allowedRoles", () => {
    vi.spyOn(AuthProviderModule, "useAuth").mockReturnValue({
      user: {
        id: "1",
        name: "Inspector",
        email: "test@example.com",
        role: "INSPECTOR",
        isActive: true,
        createdAt: "",
        updatedAt: "",
      },
      token: "valid-jwt",
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <AuthGuard allowedRoles={["ADMIN"]}>
        <div data-testid="protected-content">Admin Only Content</div>
      </AuthGuard>
    );

    expect(screen.getByText(/Access Restricted/i)).toBeInTheDocument();
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
  });
});
