import { ITelemetrySourceAdapter } from "@/domain/telemetry/telemetry-adapter.interface";
import { CreateTelemetryInput } from "@/domain/telemetry/telemetry.entity";
import { ingestTelemetrySchema } from "@/application/telemetry/telemetry.dto";
import { AppError } from "@/lib/errors";

/**
 * HTTP Transport Adapter for Telemetry Ingestion.
 *
 * Implements ITelemetrySourceAdapter to decouple the HTTP transport layer from
 * the core domain and application service. In the future, this can be swapped or
 * accompanied by MQTT, Kafka, WITSML, or WITS0 adapters without altering the core service.
 */
export class HttpTelemetryAdapter implements ITelemetrySourceAdapter<unknown> {
  adapt(rawInput: unknown): CreateTelemetryInput {
    const parseResult = ingestTelemetrySchema.safeParse(rawInput);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      const message = issue
        ? `${issue.path.join(".") || "payload"}: ${issue.message}`
        : "Invalid telemetry payload";
      throw AppError.validation(message, parseResult.error.issues);
    }

    const valid = parseResult.data;

    return {
      wellId: valid.wellId,
      sourceId: valid.sourceId,
      sequenceNumber: valid.sequenceNumber,
      timestamp: valid.timestamp,
      measurements: valid.measurements,
      metadata: valid.metadata,
    };
  }
}

export const httpTelemetryAdapter = new HttpTelemetryAdapter();
