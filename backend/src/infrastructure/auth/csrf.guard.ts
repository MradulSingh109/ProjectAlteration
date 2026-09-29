import { NextRequest } from "next/server";
import { config } from "@/config/env";
import { AppError } from "@/lib/errors";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Validates whether the incoming request source is a trusted origin for state-changing operations.
 *
 * Multi-layer Defense Strategy:
 * 1. Safe Methods (GET, HEAD, OPTIONS): Excluded from CSRF checks.
 * 2. Token-Based Non-Browser Clients: Requests authenticated via Authorization Bearer
 *    header (without auth cookies) are immune to browser cross-site forgery.
 * 3. Browser Cookie Transport:
 *    - Strict SameSite / Lax cookies ensure the browser restricts cross-site cookie transmission.
 *    - Origin / Referer verification validates request origin against:
 *      a) Host and X-Forwarded-Host (reverse proxy / ingress awareness)
 *      b) Explicitly configured TRUSTED_ORIGINS (CORS / decoupled frontend support)
 *      c) Localhost / 127.0.0.1 in non-production environments only.
 *
 * @throws AppError 403 FORBIDDEN on CSRF origin mismatch
 */
export function verifyCsrf(req: NextRequest): void {
  // 1. Safe HTTP methods do not alter state
  if (SAFE_METHODS.has(req.method)) {
    return;
  }

  // 2. If request contains Bearer token and NO auth cookies, CSRF does not apply
  const hasAuthCookie =
    req.cookies.has(config.cookies.accessTokenName) ||
    req.cookies.has(config.cookies.refreshTokenName);
  const authHeader = req.headers.get("authorization");

  if (authHeader && !hasAuthCookie) {
    return;
  }

  // 3. Extract request origin (prefer Origin, fallback to Referer)
  const originHeader = req.headers.get("origin");
  const refererHeader = req.headers.get("referer");

  let requestOrigin: string | null = null;

  if (originHeader) {
    requestOrigin = originHeader.trim().toLowerCase();
  } else if (refererHeader) {
    try {
      const parsedReferer = new URL(refererHeader);
      requestOrigin = parsedReferer.origin.toLowerCase();
    } catch {
      throw AppError.forbidden("Invalid referer header format");
    }
  }

  // 4. Direct API clients (curl, automated tests, server-to-server) without cookies
  if (!requestOrigin) {
    if (!hasAuthCookie) {
      return;
    }
    // Browser cookie authentication on mutating requests MUST supply Origin or Referer
    if (config.env === "production") {
      throw AppError.forbidden(
        "CSRF verification failed: Missing origin header",
      );
    }
    return;
  }

  // 5. Parse request origin URL
  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(requestOrigin);
  } catch {
    throw AppError.forbidden("Invalid origin header format");
  }

  // 6. Gather target server hosts (supporting reverse proxy headers)
  const allowedHosts = new Set<string>();

  const hostHeader = req.headers.get("host");
  if (hostHeader) {
    allowedHosts.add(hostHeader.toLowerCase());
  }

  const forwardedHost = req.headers.get("x-forwarded-host");
  if (forwardedHost) {
    for (const h of forwardedHost.split(",")) {
      const trimmed = h.trim().toLowerCase();
      if (trimmed) allowedHosts.add(trimmed);
    }
  }

  // Check if origin host matches current backend host or reverse proxy
  if (allowedHosts.has(parsedOrigin.host.toLowerCase())) {
    return;
  }

  // 7. Check explicitly configured TRUSTED_ORIGINS (e.g. decoupled Next.js frontend)
  for (const trusted of config.security.trustedOrigins) {
    try {
      const trustedUrl = new URL(trusted);
      if (
        trustedUrl.origin.toLowerCase() === parsedOrigin.origin.toLowerCase()
      ) {
        return;
      }
    } catch {
      // Ignore malformed entries in config
    }
  }

  // 8. Development / Test convenience for local frontend testing
  if (config.env !== "production") {
    const hostname = parsedOrigin.hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return;
    }
  }

  // Untrusted origin rejected
  throw AppError.forbidden(
    `Cross-origin request rejected: Origin '${requestOrigin}' is not authorized`,
  );
}
