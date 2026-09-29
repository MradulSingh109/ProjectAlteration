import { NextRequest, NextResponse } from "next/server";
import { authService } from "@/application/auth/auth.service";
import { errorResponse } from "@/lib/response";
import { setAuthCookies } from "@/infrastructure/auth/cookie.helper";
import { verifyCsrf } from "@/infrastructure/auth/csrf.guard";

/**
 * POST /api/v1/auth/login
 * Public authentication endpoint.
 *
 * Security:
 * - Constant-time comparison for non-existent users
 * - Generic 401 error message preventing account enumeration
 * - Transports credentials via secure HTTP-only cookies
 * - Returns only safe user data (no tokens or hashes in body)
 */
export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);
    const body = await req.json();
    const userAgent = req.headers.get("user-agent") || undefined;
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() || undefined;

    const result = await authService.login(body, { userAgent, ipAddress });

    const response = NextResponse.json(
      {
        success: true,
        data: {
          user: result.user,
        },
      },
      { status: 200 },
    );

    setAuthCookies(response, result.accessToken, result.refreshToken);

    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
