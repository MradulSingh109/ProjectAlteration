import crypto from "crypto";
import { config } from "@/config/env";
import { AppError } from "@/lib/errors";

/**
 * Machine-to-backend authentication guard for telemetry ingestion.
 *
 * Verifies machine requests using a dedicated secret/API key configured via TELEMETRY_API_KEY.
 * Employs constant-time buffer comparison to prevent timing attacks.
 * Does not expose or log credentials.
 */
export function verifyTelemetryApiKey(request: Request): void {
  const headerKey = request.headers.get("x-telemetry-api-key");
  const authHeader = request.headers.get("authorization");

  let providedKey: string | null = null;

  if (headerKey) {
    providedKey = headerKey.trim();
  } else if (authHeader && /^Bearer\s+/i.test(authHeader)) {
    providedKey = authHeader.replace(/^Bearer\s+/i, "").trim();
  }

  if (!providedKey) {
    throw AppError.unauthorized("Telemetry API key is required");
  }

  const expectedKey = config.telemetry.apiKey;

  // Constant-time comparison
  const providedBuffer = Buffer.from(providedKey);
  const expectedBuffer = Buffer.from(expectedKey);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    throw AppError.unauthorized("Invalid telemetry API key");
  }
}
