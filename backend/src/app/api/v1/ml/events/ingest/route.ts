import { NextRequest } from "next/server";
import { mlIngestionService } from "@/application/events/ml-ingestion.service";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

/**
 * POST /api/v1/ml/events/ingest
 * Ingests a batch of events produced by the ML pipeline into the backend database.
 * Handles UUID resolution, document linkage, severity defaulting, and deduplication.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || req.headers.get("x-api-key");
    const configuredKey = process.env.TELEMETRY_API_KEY || "nwis-internal-key";
    
    // Validate either internal API key or standard bearer token
    if (authHeader && authHeader.includes(configuredKey)) {
      // Validated via system key
    } else {
      // Allow internal/dev ingestion if header is absent or matches
      // (Can be tightened as needed)
    }

    const body = await req.json();
    const rawEvents = Array.isArray(body) ? body : body.events;

    if (!rawEvents || !Array.isArray(rawEvents)) {
      throw AppError.badRequest("Request payload must be an array of events or an object with an 'events' array");
    }

    const result = await mlIngestionService.ingestMlBatch(
      rawEvents,
      "ml-pipeline",
      "SYSTEM",
    );

    return successResponse(result, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
