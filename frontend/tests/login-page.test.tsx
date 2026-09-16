import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LoginPage from "@/app/login/page";
import * as AuthProviderModule from "@/providers/auth-provider";
import * as AuthApiModule from "@/lib/api/auth";
import { ApiClientError } from "@/lib/api/errors";
import * as NavigationModule from "next/navigation";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe("LoginPage Component", () => {
  const mockReplace = vi.fn();
  const mockLogin = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(NavigationModule.useRouter).mockReturnValue({
      replace: mockReplace,
    } as unknown as ReturnType<typeof NavigationModule.useRouter>);

    vi.mocked(NavigationModule.useSearchParams).mockReturnValue({
      get: vi.fn().mockReturnValue(null),
    } as unknown as ReturnType<typeof NavigationModule.useSearchParams>);

    vi.spyOn(AuthProviderModule, "useAuth").mockReturnValue({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      login: mockLogin,
      logout: vi.fn(),
    });
  });

  it("renders login form elements and headings accurately", () => {
    renderWithProviders(<LoginPage />);

    expect(screen.getByText("Sign In to Portal")).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Sign In/i })
    ).toBeInTheDocument();
  });

  it("displays validation errors when submitting an empty form", async () => {
    renderWithProviders(<LoginPage />);

    const submitButton = screen.getByRole("button", { name: /Sign In/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Email is required/i)).toBeInTheDocument();
      expect(screen.getByText(/Password is required/i)).toBeInTheDocument();
    });
  });

  it("displays validation error when entering an invalid email format", async () => {
    renderWithProviders(<LoginPage />);

    const emailInput = screen.getByLabelText(/Email Address/i);
    fireEvent.change(emailInput, { target: { value: "not-valid-email" } });

    const submitButton = screen.getByRole("button", { name: /Sign In/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText(/Please enter a valid email address/i)
      ).toBeInTheDocument();
    });
  });

  it("handles successful login submission", async () => {
    const mockAuthResponse = {
      user: {
        id: "usr-123",
        email: "inspector@example.com",
        name: "Test Inspector",
        role: "INSPECTOR" as const,
        isActive: true,
        createdAt: "2026-09-16T00:00:00.000Z",
        updatedAt: "2026-09-16T00:00:00.000Z",
      },
      token: "jwt-token-xyz",
    };

    const loginApiSpy = vi
      .spyOn(AuthApiModule, "loginApi")
      .mockResolvedValueOnce(mockAuthResponse);

    renderWithProviders(<LoginPage />);

    const emailInput = screen.getByLabelText(/Email Address/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    const submitButton = screen.getByRole("button", { name: /Sign In/i });

    fireEvent.change(emailInput, { target: { value: "inspector@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "ValidPassword123!" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(loginApiSpy).toHaveBeenCalledWith({
        email: "inspector@example.com",
        password: "ValidPassword123!",
      });
      expect(mockLogin).toHaveBeenCalledWith(mockAuthResponse);
      expect(mockReplace).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("displays server error message on invalid credentials", async () => {
    vi.spyOn(AuthApiModule, "loginApi").mockRejectedValueOnce(
      new ApiClientError("Invalid email or password", {
        code: "INVALID_CREDENTIALS",
        statusCode: 401,
      })
    );

    renderWithProviders(<LoginPage />);

    const emailInput = screen.getByLabelText(/Email Address/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    const submitButton = screen.getByRole("button", { name: /Sign In/i });

    fireEvent.change(emailInput, { target: { value: "inspector@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "WrongPassword!" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText(/Invalid email or password\. Please try again\./i)
      ).toBeInTheDocument();
    });
  });

  it("redirects authenticated user to dashboard immediately", () => {
    vi.spyOn(AuthProviderModule, "useAuth").mockReturnValue({
      user: {
        id: "usr-1",
        email: "active@example.com",
        name: "Active User",
        role: "INSPECTOR",
        isActive: true,
        createdAt: "",
        updatedAt: "",
      },
      token: "token",
      isAuthenticated: true,
      isLoading: false,
      login: mockLogin,
      logout: vi.fn(),
    });

    renderWithProviders(<LoginPage />);

    expect(mockReplace).toHaveBeenCalledWith("/dashboard");
  });
});

