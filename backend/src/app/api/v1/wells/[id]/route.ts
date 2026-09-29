import { NextRequest } from "next/server";
import { wellService } from "@/application/wells/well.service";
import { requireAuth } from "@/application/auth/guard";
import { Role } from "@/domain/auth/roles";
import { verifyCsrf } from "@/infrastructure/auth/csrf.guard";
import { successResponse, errorResponse } from "@/lib/response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/wells/:id
 * Retrieves single well details including formations.
 * RBAC: Accessible to all authenticated users.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth(req);
    const { id } = await params;

    const well = await wellService.getWell(id);

    return successResponse({ well }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * PATCH /api/v1/wells/:id
 * Updates an existing well master record.
 * RBAC: Restricted to operational roles (ADMIN, DRILLING_ENGINEER, GEOLOGIST).
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth(req, Role.ADMIN, Role.DRILLING_ENGINEER, Role.GEOLOGIST);
    verifyCsrf(req);

    const { id } = await params;
    const body = await req.json();

    const well = await wellService.updateWell(id, body);

    return successResponse({ well }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
