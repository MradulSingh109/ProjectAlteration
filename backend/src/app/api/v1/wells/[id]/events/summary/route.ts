import { NextRequest } from "next/server";
import { drillingEventService } from "@/application/events/drilling-event.service";
import { requireAuth } from "@/application/auth/guard";
import { successResponse, errorResponse } from "@/lib/response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/wells/:id/events/summary
 * Computes deterministic database-aggregated summary of drilling events for the specified well.
 *
 * RBAC: Accessible to all authenticated users (including VIEWER).
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth(req);
    const { id: wellId } = await params;

    const summary = await drillingEventService.getWellEventSummary(wellId);

    return successResponse({ ...summary, summary }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
