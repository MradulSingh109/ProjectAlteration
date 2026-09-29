import { NextRequest, NextResponse } from "next/server";
import { authService } from "@/application/auth/auth.service";
import { setAuthCookies } from "@/infrastructure/auth/cookie.helper";
import { errorResponse } from "@/lib/response";

/**
 * POST /api/v1/auth/demo
 *
 * Convenience authentication endpoint for demo and frontend UI sessions.
 * Logs in as the predefined demo engineer, returning user data and setting
 * secure HTTP-only cookies as well as Bearer token.
 */
export async function POST(req: NextRequest) {
  try {
    const userAgent = req.headers.get("user-agent") || undefined;
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() || undefined;

    const result = await authService.login(
      { email: "demo@nwis.gov.in", password: "Password123!" },
      { userAgent, ipAddress },
    );

    const response = NextResponse.json(
      {
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
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

export async function GET(req: NextRequest) {
  return POST(req);
}
