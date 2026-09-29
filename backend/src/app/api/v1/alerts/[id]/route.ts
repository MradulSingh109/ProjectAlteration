import { NextRequest } from "next/server";
import { requireAuth } from "@/application/auth/guard";
import { alertLifecycleService } from "@/application/alerts/alert-lifecycle.service";
import { successResponse, errorResponse } from "@/lib/response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/alerts/:id
 *
 * Retrieves detailed alert evidence, explanation, and lifecycle history.
 *
 * RBAC: Accessible to all authenticated users (VIEWER, GEOLOGIST, DRILLING_ENGINEER, ADMIN).
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth(req);
    const { id: alertId } = await params;

    const alert = await alertLifecycleService.getAlertById(alertId);

    return successResponse({ alert }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
