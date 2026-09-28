import { NextRequest } from "next/server";
import { requireAuth } from "@/application/auth/guard";
import { Role } from "@/domain/auth/roles";
import { verifyCsrf } from "@/infrastructure/auth/csrf.guard";
import { alertLifecycleService } from "@/application/alerts/alert-lifecycle.service";
import { resolveAlertSchema } from "@/application/alerts/alert.dto";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/alerts/:id/resolve
 *
 * Transitions an alert from ACTIVE or ACKNOWLEDGED to RESOLVED.
 * Records resolving operator identity, server timestamp, and optional resolution notes.
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
    const body = await req.json().catch(() => ({}));

    const parsed = resolveAlertSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const message = issue
        ? `${issue.path.join(".") || "payload"}: ${issue.message}`
        : "Invalid resolution payload";
      throw AppError.validation(message, parsed.error.issues);
    }

    const alert = await alertLifecycleService.resolveAlert(
      alertId,
      user.id,
      user.role,
      parsed.data.resolutionNotes,
    );

    return successResponse({ alert }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
