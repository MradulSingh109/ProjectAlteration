import { NextRequest, NextResponse } from "next/server";
import { config } from "@/config/env";

const isProd = process.env.NODE_ENV === "production";

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax" as const,
  path: "/",
};

export const ACCESS_TOKEN_MAX_AGE = 60 * 60; // 1 hour in seconds
export const REFRESH_TOKEN_MAX_AGE =
  config.jwt.refreshTokenExpiresInDays * 24 * 60 * 60; // 7 days in seconds

/**
 * Sets secure HTTP-only cookies on the given NextResponse.
 */
export function setAuthCookies(
  res: NextResponse,
  accessToken: string,
  refreshToken?: string,
): void {
  res.cookies.set({
    name: config.cookies.accessTokenName,
    value: accessToken,
    ...COOKIE_OPTIONS,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });

  if (refreshToken) {
    res.cookies.set({
      name: config.cookies.refreshTokenName,
      value: refreshToken,
      ...COOKIE_OPTIONS,
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });
  }
}

/**
 * Clears authentication cookies upon logout.
 */
export function clearAuthCookies(res: NextResponse): void {
  res.cookies.set({
    name: config.cookies.accessTokenName,
    value: "",
    ...COOKIE_OPTIONS,
    maxAge: 0,
  });

  res.cookies.set({
    name: config.cookies.refreshTokenName,
    value: "",
    ...COOKIE_OPTIONS,
    maxAge: 0,
  });
}

/**
 * Extracts access token from HTTP-only cookie or Authorization header.
 * Primary: Cookie (for browsers)
 * Secondary: Authorization: Bearer <token> (for programmatic/test clients)
 */
export function getAccessTokenFromRequest(req: NextRequest): string | null {
  // 1. Check HTTP-only cookie
  const cookieToken = req.cookies.get(config.cookies.accessTokenName)?.value;
  if (cookieToken) {
    return cookieToken;
  }

  // 2. Check Bearer Authorization header
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }

  return null;
}

/**
 * Extracts refresh token from HTTP-only cookie.
 */
export function getRefreshTokenFromRequest(req: NextRequest): string | null {
  return req.cookies.get(config.cookies.refreshTokenName)?.value || null;
}
