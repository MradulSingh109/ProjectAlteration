import { describe, it, expect, vi } from "vitest";
import { NextResponse } from "next/server";
import { AuthService } from "@/application/auth/auth.service";
import { IAuthRepository } from "@/domain/auth/auth.repository.interface";
import {
  clearAuthCookies,
  setAuthCookies,
} from "@/infrastructure/auth/cookie.helper";
import { config } from "@/config/env";

describe("Logout & Session Invalidation", () => {
  it("revokes session in repository upon logout", async () => {
    const revokeSessionMock = vi.fn(async () => {});
    const repo: IAuthRepository = {
      findUserByEmail: vi.fn(),
      findUserById: vi.fn(),
      createUser: vi.fn(),
      createSession: vi.fn(),
      findSessionById: vi.fn(),
      findSessionByRefreshTokenHash: vi.fn(),
      revokeSession: revokeSessionMock,
      revokeAllUserSessions: vi.fn(),
      touchSession: vi.fn(),
    };

    const authService = new AuthService(repo);
    await authService.logout("test-session-id");

    expect(revokeSessionMock).toHaveBeenCalledWith("test-session-id");
  });

  it("clears authentication cookies by expiring them immediately", () => {
    const res = NextResponse.json({ success: true });

    // Set cookies first
    setAuthCookies(res, "sample_jwt_access_token", "sample_refresh_token");

    // Clear cookies
    clearAuthCookies(res);

    const accessCookie = res.cookies.get(config.cookies.accessTokenName);
    const refreshCookie = res.cookies.get(config.cookies.refreshTokenName);

    expect(accessCookie).toBeDefined();
    expect(accessCookie?.value).toBe("");
    expect(accessCookie?.maxAge).toBe(0);

    expect(refreshCookie).toBeDefined();
    expect(refreshCookie?.value).toBe("");
    expect(refreshCookie?.maxAge).toBe(0);
  });
});
