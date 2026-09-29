import { NextRequest } from "next/server";
import { authService } from "@/application/auth/auth.service";
import { successResponse, errorResponse } from "@/lib/response";
import { verifyCsrf } from "@/infrastructure/auth/csrf.guard";

/**
 * POST /api/v1/auth/register
 * Public registration endpoint.
 *
 * Security:
 * - Validates input with Zod
 * - Server enforces Role.VIEWER (no privilege escalation)
 * - Safe user returned without password hash
 */
export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);
    const body = await req.json();
    const user = await authService.register(body);
    return successResponse({ user }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
