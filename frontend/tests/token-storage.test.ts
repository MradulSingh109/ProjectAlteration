import { describe, it, expect, beforeEach } from "vitest";
import { tokenStorage } from "@/lib/auth/token-storage";
import { AuthUser } from "@/types/auth";

const mockUser: AuthUser = {
  id: "4c4246bb-5645-4fd1-a185-5b5eb0ea21fa",
  email: "inspector@example.com",
  name: "Legal Inspector",
  role: "INSPECTOR",
  isActive: true,
  createdAt: "2026-09-16T12:00:00.000Z",
  updatedAt: "2026-09-16T12:00:00.000Z",
};

describe("Token Storage Manager", () => {
  beforeEach(() => {
    tokenStorage.clearSession();
    window.localStorage.clear();
  });

  it("stores and retrieves JWT token accurately", () => {
    expect(tokenStorage.getToken()).toBeNull();

    const sampleToken = "header.payload.signature";
    tokenStorage.setToken(sampleToken);

    expect(tokenStorage.getToken()).toBe(sampleToken);
  });

  it("clears token on demand", () => {
    tokenStorage.setToken("sample-token");
    expect(tokenStorage.getToken()).toBe("sample-token");

    tokenStorage.clearToken();
    expect(tokenStorage.getToken()).toBeNull();
  });

  it("stores and retrieves sanitized user profile", () => {
    expect(tokenStorage.getStoredUser()).toBeNull();

    tokenStorage.setStoredUser(mockUser);
    const retrieved = tokenStorage.getStoredUser();

    expect(retrieved).toEqual(mockUser);
    expect(retrieved?.role).toBe("INSPECTOR");
  });

  it("handles corrupted stored user JSON gracefully", () => {
    window.localStorage.setItem("sih26034_auth_user", "invalid-json{");

    expect(tokenStorage.getStoredUser()).toBeNull();
  });

  it("clears both token and user profile on clearSession()", () => {
    tokenStorage.setToken("token-123");
    tokenStorage.setStoredUser(mockUser);

    expect(tokenStorage.getToken()).toBe("token-123");
    expect(tokenStorage.getStoredUser()).not.toBeNull();

    tokenStorage.clearSession();

    expect(tokenStorage.getToken()).toBeNull();
    expect(tokenStorage.getStoredUser()).toBeNull();
  });
});
