import { NextRequest } from "next/server";
import { drillingEventService } from "@/application/events/drilling-event.service";
import { requireAuth } from "@/application/auth/guard";
import { successResponse, errorResponse } from "@/lib/response";

interface RouteParams {
  params: Promise<{ eventId: string }>;
}

/**
 * GET /api/v1/events/:eventId
 * Retrieves detailed drilling event data including safe source document provenance metadata.
 *
 * RBAC: Accessible to all authenticated users (including VIEWER).
 * SECURITY: Never exposes physical storage keys, directory roots, or internal paths.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireAuth(req);
    const { eventId } = await params;

    const event = await drillingEventService.getEventDetail(eventId, user.id);

    return successResponse({ event }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
