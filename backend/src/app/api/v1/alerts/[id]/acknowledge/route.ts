import { NextRequest } from "next/server";
import { requireAuth } from "@/application/auth/guard";
import { Role } from "@/domain/auth/roles";
import { verifyCsrf } from "@/infrastructure/auth/csrf.guard";
import { alertLifecycleService } from "@/application/alerts/alert-lifecycle.service";
import { successResponse, errorResponse } from "@/lib/response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/alerts/:id/acknowledge
 *
 * Transitions an alert from ACTIVE to ACKNOWLEDGED.
 * Records acknowledging operator identity and server timestamp.
 *
 * RBAC: Restricted to operational roles (ADMIN, DRILLING_ENGINEER, GEOLOGIST).
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireAuth(
      req,
      Role.ADMIN,
      Role.DRILLING_ENGINEER,
      Role.GEOLOGIST,
    );
    verifyCsrf(req);

    const { id: alertId } = await params;

    const alert = await alertLifecycleService.acknowledgeAlert(
      alertId,
      user.id,
      user.role,
    );

    return successResponse(alert, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
