import { NextRequest } from "next/server";
import { wellService } from "@/application/wells/well.service";
import { requireAuth } from "@/application/auth/guard";
import { Role } from "@/domain/auth/roles";
import { QueryWellsSchema } from "@/application/wells/well.dto";
import { verifyCsrf } from "@/infrastructure/auth/csrf.guard";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

/**
 * POST /api/v1/wells
 * Creates a new well master record.
 * RBAC: Restricted to operational roles (ADMIN, DRILLING_ENGINEER, GEOLOGIST).
 */
export async function POST(req: NextRequest) {
  try {
    await requireAuth(req, Role.ADMIN, Role.DRILLING_ENGINEER, Role.GEOLOGIST);
    verifyCsrf(req);

    const body = await req.json();
    const well = await wellService.createWell(body);

    return successResponse({ well }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * GET /api/v1/wells
 * Retrieves a list of wells with optional filtering by field and status.
 * RBAC: Accessible to all authenticated users (including VIEWER).
 */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);

    const searchParams = req.nextUrl.searchParams;
    const rawQuery: Record<string, string> = {};
    if (searchParams.has("field")) rawQuery.field = searchParams.get("field")!;
    if (searchParams.has("status"))
      rawQuery.status = searchParams.get("status")!;
    if (searchParams.has("limit")) rawQuery.limit = searchParams.get("limit")!;
    if (searchParams.has("offset"))
      rawQuery.offset = searchParams.get("offset")!;

    const parsed = QueryWellsSchema.safeParse(rawQuery);
    if (!parsed.success) {
      throw AppError.validation(
        parsed.error.issues[0]?.message || "Invalid query parameters",
        parsed.error.issues,
      );
    }

    const wells = await wellService.listWells(parsed.data);

    return successResponse({ wells }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
