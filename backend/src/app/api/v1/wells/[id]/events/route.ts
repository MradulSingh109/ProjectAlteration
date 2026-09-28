import { NextRequest } from "next/server";
import { drillingEventService } from "@/application/events/drilling-event.service";
import { requireAuth } from "@/application/auth/guard";
import { Role } from "@/domain/auth/roles";
import {
  EventType,
  EventSeverity,
  ReviewStatus,
} from "@/domain/events/drilling-event.entity";
import { verifyCsrf } from "@/infrastructure/auth/csrf.guard";
import { successResponse, errorResponse } from "@/lib/response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/wells/:id/events
 * Ingests a new candidate drilling operational event for a well.
 *
 * RBAC: Restricted to operational roles (ADMIN, DRILLING_ENGINEER, GEOLOGIST).
 * Initial Status: Strictly pinned to PENDING_REVIEW.
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

    const { id: wellId } = await params;
    const body = await req.json();

    const event = await drillingEventService.createCandidateEvent(
      wellId,
      body,
      user.id,
      user.role,
    );

    return successResponse({ event }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * GET /api/v1/wells/:id/events
 * Lists drilling events associated with the specified well, with optional filters.
 *
 * RBAC: Accessible to all authenticated users (including VIEWER).
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth(req);
    const { id: wellId } = await params;

    const queryParams: Record<string, string> = {};
    req.nextUrl.searchParams.forEach((val, key) => {
      queryParams[key] = val;
    });

    const result = await drillingEventService.listEventsByWell(
      wellId,
      queryParams,
    );

    return successResponse(
      {
        items: result.items,
        events: result.items,
        pagination: result.pagination,
      },
      200,
    );
  } catch (error) {
    return errorResponse(error);
  }
}
