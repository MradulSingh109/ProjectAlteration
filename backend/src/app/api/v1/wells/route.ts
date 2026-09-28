import { NextRequest } from "next/server";
import { wellService } from "@/application/wells/well.service";
import { requireAuth } from "@/application/auth/guard";
import { Role } from "@/domain/auth/roles";
import { WellStatus } from "@/domain/wells/well.entity";
import { verifyCsrf } from "@/infrastructure/auth/csrf.guard";
import { successResponse, errorResponse } from "@/lib/response";

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
    const field = searchParams.get("field") || undefined;
    const status = (searchParams.get("status") as WellStatus) || undefined;
    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!, 10)
      : undefined;
    const offset = searchParams.get("offset")
      ? parseInt(searchParams.get("offset")!, 10)
      : undefined;

    const wells = await wellService.listWells({ field, status, limit, offset });

    return successResponse({ wells }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
