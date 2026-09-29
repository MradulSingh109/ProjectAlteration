import { NextRequest } from "next/server";
import { drillingEventService } from "@/application/events/drilling-event.service";
import { requireAuth } from "@/application/auth/guard";
import { successResponse, errorResponse } from "@/lib/response";

interface RouteParams {
  params: Promise<{ documentId: string }>;
}

/**
 * GET /api/v1/documents/:documentId/events
 * Retrieves drilling events originating from the specified technical document.
 *
 * RBAC: Accessible to all authenticated users (including VIEWER).
 * SECURITY: Never exposes storageKey, local file paths, or credentials.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth(req);
    const { documentId } = await params;

    const queryParams: Record<string, string> = {};
    req.nextUrl.searchParams.forEach((val, key) => {
      queryParams[key] = val;
    });

    const result = await drillingEventService.listEventsByDocument(
      documentId,
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
