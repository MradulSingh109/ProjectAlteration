import { NextRequest } from "next/server";
import { offsetWellService } from "@/application/wells/offset-well.service";
import { requireAuth } from "@/application/auth/guard";
import { successResponse, errorResponse } from "@/lib/response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/wells/:id/offsets
 * Discovers and analyzes relevant historical offset wells within a spatial radius,
 * computing deterministic formation stratigraphic overlap, borehole depth interval overlap,
 * historical drilling event evidence, and an explainable multi-factor relevance ranking.
 *
 * RBAC: Accessible to all authenticated roles (VIEWER, DRILLING_ENGINEER, GEOLOGIST, ADMIN).
 * Zero AI/ML heuristics — purely deterministic database evidence.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth(req);
    const { id: wellId } = await params;

    const queryParams: Record<string, string> = {};
    req.nextUrl.searchParams.forEach((val, key) => {
      queryParams[key] = val;
    });

    const result = await offsetWellService.findOffsetWells(wellId, queryParams);

    return successResponse(result, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
