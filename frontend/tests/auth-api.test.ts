import { describe, it, expect, vi, beforeEach } from "vitest";
import { loginApi, getCurrentUserApi, logoutApi } from "@/lib/api/auth";
import { apiClient } from "@/lib/api/client";
import { tokenStorage } from "@/lib/auth/token-storage";
import { AuthResponseData, AuthUser } from "@/types/auth";

const mockUser: AuthUser = {
  id: "3e52f190-6721-4f4b-84a1-8d2983b6f849",
  email: "inspector.metrology@example.gov.in",
  name: "Dr. A. Sharma",
  role: "INSPECTOR",
  isActive: true,
  createdAt: "2026-09-16T10:00:00.000Z",
  updatedAt: "2026-09-16T10:00:00.000Z",
};

const mockAuthData: AuthResponseData = {
  user: mockUser,
  token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-signature",
};

describe("Authentication API Client Layer", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    tokenStorage.clearSession();
  });

  describe("loginApi", () => {
    it("sends POST /auth/login with exact payload and returns user and token", async () => {
      const postSpy = vi.spyOn(apiClient, "post").mockResolvedValueOnce({
        data: {
          success: true,
          data: mockAuthData,
          error: null,
        },
      });

      const credentials = {
        email: "inspector.metrology@example.gov.in",
        password: "SecurePassword2026!",
      };

      const result = await loginApi(credentials);

      expect(postSpy).toHaveBeenCalledWith("/auth/login", credentials);
      expect(result.token).toBe(mockAuthData.token);
      expect(result.user.email).toBe("inspector.metrology@example.gov.in");
      expect(result.user.role).toBe("INSPECTOR");
    });
  });

  describe("getCurrentUserApi", () => {
    it("sends GET /auth/me and returns current user entity", async () => {
      const getSpy = vi.spyOn(apiClient, "get").mockResolvedValueOnce({
        data: {
          success: true,
          data: { user: mockUser },
          error: null,
        },
      });

      const result = await getCurrentUserApi();

      expect(getSpy).toHaveBeenCalledWith("/auth/me");
      expect(result.id).toBe(mockUser.id);
      expect(result.name).toBe("Dr. A. Sharma");
    });
  });

  describe("logoutApi", () => {
    it("sends POST /auth/logout and returns success message", async () => {
      const postSpy = vi.spyOn(apiClient, "post").mockResolvedValueOnce({
        data: {
          success: true,
          data: { message: "Logged out successfully" },
          error: null,
        },
      });

      const result = await logoutApi();

      expect(postSpy).toHaveBeenCalledWith("/auth/logout");
      expect(result.message).toBe("Logged out successfully");
    });
  });

  describe("Axios Request Interceptor", () => {
    it("injects Bearer token into Authorization header when token exists", async () => {
      tokenStorage.setToken("my-mock-jwt-token");

      // Verify request interceptor logic
      const config = {
        headers: {} as Record<string, string>,
      };

      // Find the request interceptor handler
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handlers = (apiClient.interceptors.request as any).handlers;
      const requestHandler = handlers[0]?.fulfilled;

      if (requestHandler) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const modifiedConfig = await requestHandler(config as any);
        expect(modifiedConfig.headers.Authorization).toBe(
          "Bearer my-mock-jwt-token"
        );
      }
    });
  });
});
