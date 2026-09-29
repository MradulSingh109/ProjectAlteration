import { NextRequest } from "next/server";
import { formationService } from "@/application/wells/formation.service";
import { requireAuth } from "@/application/auth/guard";
import { Role } from "@/domain/auth/roles";
import { verifyCsrf } from "@/infrastructure/auth/csrf.guard";
import { successResponse, errorResponse } from "@/lib/response";

interface RouteParams {
  params: Promise<{ id: string; formationId: string }>;
}

/**
 * PATCH /api/v1/wells/:id/formations/:formationId
 * Updates an existing geological formation record.
 * RBAC: Restricted to operational roles (ADMIN, DRILLING_ENGINEER, GEOLOGIST).
 * Security: Validates that formationId belongs to the specified wellId.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth(req, Role.ADMIN, Role.DRILLING_ENGINEER, Role.GEOLOGIST);
    verifyCsrf(req);

    const { id: wellId, formationId } = await params;
    const body = await req.json();

    const formation = await formationService.updateFormation(
      wellId,
      formationId,
      body,
    );

    return successResponse({ formation }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
