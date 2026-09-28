import { NextRequest } from "next/server";
import { authenticateRequest } from "@/application/auth/guard";
import { successResponse, errorResponse } from "@/lib/response";

/**
 * GET /api/v1/auth/me
 * Authenticated user profile retrieval.
 *
 * Security:
 * - Requires valid, unexpired, non-revoked session
 * - Returns only safe user entity (no password hash or token)
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await authenticateRequest(req);
    return successResponse({ user }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
