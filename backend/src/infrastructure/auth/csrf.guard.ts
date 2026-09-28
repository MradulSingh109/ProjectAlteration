import { NextRequest } from "next/server";
import { AppError } from "@/lib/errors";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Validates request origin against host headers for state-changing requests (POST, PUT, PATCH, DELETE)
 * when cookie-based transport is active.
 *
 * Defense-in-depth against Cross-Site Request Forgery (CSRF):
 * 1. Cookies are tagged with SameSite=Lax.
 * 2. Origin / Referer headers are verified against Host header on mutating HTTP verbs.
 * 3. Pure Bearer token requests (Authorization header) are immune to browser CSRF.
 */
export function verifyCsrf(req: NextRequest): void {
  if (SAFE_METHODS.has(req.method)) {
    return;
  }

  // If request contains Bearer token and NO auth cookie, CSRF does not apply
  const hasAuthCookie =
    req.cookies.has("nwis_access_token") ||
    req.cookies.has("nwis_refresh_token");
  const authHeader = req.headers.get("authorization");

  if (authHeader && !hasAuthCookie) {
    return;
  }

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const host = req.headers.get("host");

  if (!origin && !referer) {
    // Non-browser or direct API clients (curl, automated tests) lacking origin are allowed
    return;
  }

  const targetHost = host || "";

  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (
        originUrl.host !== targetHost &&
        !originUrl.host.includes("localhost") &&
        !originUrl.host.includes("127.0.0.1")
      ) {
        throw AppError.forbidden("Cross-origin request rejected");
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.forbidden("Invalid origin header format");
    }
  } else if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (
        refererUrl.host !== targetHost &&
        !refererUrl.host.includes("localhost") &&
        !refererUrl.host.includes("127.0.0.1")
      ) {
        throw AppError.forbidden("Cross-origin referer rejected");
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.forbidden("Invalid referer header format");
    }
  }
}
