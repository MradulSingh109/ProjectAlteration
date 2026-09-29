import { NextRequest } from "next/server";
import { verifyTelemetryApiKey } from "@/application/telemetry/telemetry-auth.guard";
import { telemetryIngestionService } from "@/application/telemetry/telemetry-ingestion.service";
import { toTelemetryResponseDto } from "@/application/telemetry/telemetry.dto";
import { successResponse, errorResponse } from "@/lib/response";

/**
 * POST /api/v1/telemetry/readings
 *
 * Ingests a canonical drilling telemetry reading via HTTP transport adapter.
 * Uses dedicated machine authentication (TELEMETRY_API_KEY).
 *
 * Idempotency:
 * - If reading is new: persists and returns 201 Created with status "INGESTED".
 * - If reading is duplicate (wellId + sourceId + sequenceNumber): returns 200 OK with status "ALREADY_INGESTED".
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Machine authentication
    verifyTelemetryApiKey(req);

    // 2. Parse body
    const body = await req.json();

    // 3. Ingest via service
    const result = await telemetryIngestionService.ingest(body);

    const statusCode = result.isDuplicate ? 200 : 201;

    return successResponse(
      {
        reading: toTelemetryResponseDto(result.reading),
        status: result.status,
        isDuplicate: result.isDuplicate,
      },
      statusCode,
    );
  } catch (error) {
    return errorResponse(error);
  }
}
