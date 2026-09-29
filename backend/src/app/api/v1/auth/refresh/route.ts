import { NextRequest, NextResponse } from "next/server";
import { authService } from "@/application/auth/auth.service";
import {
  getRefreshTokenFromRequest,
  setAuthCookies,
} from "@/infrastructure/auth/cookie.helper";
import { verifyCsrf } from "@/infrastructure/auth/csrf.guard";
import { errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

/**
 * POST /api/v1/auth/refresh
 * Token refresh and rotation endpoint.
 *
 * Security:
 * - Validates CSRF for browser requests
 * - Extracts refresh token from secure HTTP-only cookie (with body fallback for API clients)
 * - Verifies session active state and user validity in database
 * - Rotates refresh token (generates new token, replaces SHA-256 hash in DB)
 * - Old refresh token is rendered immediately unusable (replay/reuse protection)
 * - Sets rotated cookies (new access JWT and new refresh token)
 * - Returns only safe user data in response body (no raw secrets or tokens in JSON)
 */
export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);

    // 1. Extract refresh token from HTTP-only cookie
    let rawRefreshToken = getRefreshTokenFromRequest(req);

    // 2. Fallback to JSON body for non-browser/test programmatic clients if cookie absent
    if (!rawRefreshToken) {
      try {
        const body = await req.json();
        if (body && typeof body.refreshToken === "string") {
          rawRefreshToken = body.refreshToken;
        }
      } catch {
        // Body parsing may fail if request had empty body, ignore
      }
    }

    if (!rawRefreshToken) {
      throw AppError.unauthorized(
        "Refresh token is required",
        "SESSION_EXPIRED",
      );
    }

    // 3. Execute refresh and rotation in service layer
    const result = await authService.refreshToken(rawRefreshToken);

    // 4. Return safe user data in JSON body
    const response = NextResponse.json(
      {
        success: true,
        data: {
          user: result.user,
        },
      },
      { status: 200 },
    );

    // 5. Deliver new rotated credentials via secure HTTP-only cookies
    setAuthCookies(response, result.accessToken, result.refreshToken);

    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
