import { NextRequest } from "next/server";
import { requireAuth } from "@/application/auth/guard";
import { telemetryIngestionService } from "@/application/telemetry/telemetry-ingestion.service";
import { toTelemetryResponseDto } from "@/application/telemetry/telemetry.dto";
import { successResponse, errorResponse } from "@/lib/response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/wells/:id/telemetry
 *
 * Retrieves chronological drilling telemetry readings for a well.
 * Supports date-range filtering (from/to), pagination (page/pageSize), and sortOrder (asc/desc).
 *
 * RBAC: Accessible to all authenticated users (VIEWER, GEOLOGIST, DRILLING_ENGINEER, ADMIN).
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    // 1. Authenticate human user
    await requireAuth(req);

    // 2. Resolve route parameters
    const { id: wellId } = await params;

    // 3. Extract query parameters
    const queryParams: Record<string, string> = {};
    req.nextUrl.searchParams.forEach((val, key) => {
      queryParams[key] = val;
    });

    // 4. Query service
    const result = await telemetryIngestionService.queryTelemetry(
      wellId,
      queryParams,
    );

    return successResponse(
      {
        wellId: result.wellId,
        items: result.items.map(toTelemetryResponseDto),
        pagination: result.pagination,
        timeRange: result.timeRange,
      },
      200,
    );
  } catch (error) {
    return errorResponse(error);
  }
}
