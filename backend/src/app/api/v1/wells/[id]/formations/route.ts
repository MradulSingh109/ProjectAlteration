import { NextRequest } from "next/server";
import { formationService } from "@/application/wells/formation.service";
import { requireAuth } from "@/application/auth/guard";
import { Role } from "@/domain/auth/roles";
import { verifyCsrf } from "@/infrastructure/auth/csrf.guard";
import { successResponse, errorResponse } from "@/lib/response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/wells/:id/formations
 * Appends a geological formation to the specified well.
 * RBAC: Restricted to operational roles (ADMIN, DRILLING_ENGINEER, GEOLOGIST).
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth(req, Role.ADMIN, Role.DRILLING_ENGINEER, Role.GEOLOGIST);
    verifyCsrf(req);

    const { id: wellId } = await params;
    const body = await req.json();

    const formation = await formationService.createFormation(wellId, body);

    return successResponse({ formation }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * GET /api/v1/wells/:id/formations
 * Retrieves all formations associated with a well in stratigraphic order.
 * RBAC: Accessible to all authenticated users.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth(req);
    const { id: wellId } = await params;

    const formations = await formationService.listFormations(wellId);

    return successResponse({ formations }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
