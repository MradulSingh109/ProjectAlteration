import { NextRequest, NextResponse } from "next/server";
import { authService } from "@/application/auth/auth.service";
import {
  clearAuthCookies,
  getAccessTokenFromRequest,
} from "@/infrastructure/auth/cookie.helper";
import { jwtService } from "@/infrastructure/auth/jwt.service";
import { verifyCsrf } from "@/infrastructure/auth/csrf.guard";
import { errorResponse } from "@/lib/response";

/**
 * POST /api/v1/auth/logout
 * Session invalidation and cookie clearance endpoint.
 *
 * Security:
 * - Revokes persistent session in database
 * - Sets auth cookies maxAge=0 to purge them from client
 */
export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);
    const token = getAccessTokenFromRequest(req);

    if (token) {
      try {
        const payload = await jwtService.verifyAccessToken(token);
        if (payload.sessionId) {
          await authService.logout(payload.sessionId);
        }
      } catch {
        // Expired/invalid tokens can still be logged out by clearing client cookies
      }
    }

    const response = NextResponse.json(
      {
        success: true,
        data: {
          message: "Logged out successfully",
        },
      },
      { status: 200 },
    );

    clearAuthCookies(response);
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
