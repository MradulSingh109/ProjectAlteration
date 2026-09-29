import { NextRequest } from "next/server";
import { wellService } from "@/application/wells/well.service";
import { requireAuth } from "@/application/auth/guard";
import { successResponse, errorResponse } from "@/lib/response";

/**
 * GET /api/v1/wells/nearby?latitude=...&longitude=...&radiusKm=10
 * Proximity search for offset wells within requested radius (max 50 km).
 * RBAC: Accessible to all authenticated users.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);

    const searchParams = req.nextUrl.searchParams;
    const query = {
      latitude: searchParams.get("latitude"),
      longitude: searchParams.get("longitude"),
      radiusKm: searchParams.get("radiusKm") || 10,
      limit: searchParams.get("limit") || 50,
    };

    const wells = await wellService.findNearbyWells(query);

    return successResponse({ wells }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
