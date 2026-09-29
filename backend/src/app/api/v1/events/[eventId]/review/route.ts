import { NextRequest } from "next/server";
import { drillingEventService } from "@/application/events/drilling-event.service";
import { requireAuth } from "@/application/auth/guard";
import { Role } from "@/domain/auth/roles";
import { verifyCsrf } from "@/infrastructure/auth/csrf.guard";
import { successResponse, errorResponse } from "@/lib/response";

interface RouteParams {
  params: Promise<{ eventId: string }>;
}

/**
 * PATCH /api/v1/events/:eventId/review
 * Submits a human review decision (APPROVE, EDIT, or INVALIDATE) for a candidate drilling event.
 *
 * RBAC: Restricted to operational engineering roles (ADMIN, DRILLING_ENGINEER, GEOLOGIST).
 * VIEWER role is strictly forbidden from reviewing events.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireAuth(
      req,
      Role.ADMIN,
      Role.DRILLING_ENGINEER,
      Role.GEOLOGIST,
    );
    verifyCsrf(req);

    const { eventId } = await params;
    const body = await req.json();

    const event = await drillingEventService.reviewEvent(
      eventId,
      body,
      user.id,
      user.role,
    );

    return successResponse({ event }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
