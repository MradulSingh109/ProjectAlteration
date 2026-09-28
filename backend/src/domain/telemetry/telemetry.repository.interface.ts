import {
  CanonicalTelemetryReading,
  CreateTelemetryInput,
  TelemetryFilterCriteria,
  PaginatedTelemetryResult,
} from "./telemetry.entity";

/**
 * Repository interface for drilling telemetry persistence.
 * Decouples the domain/application layer from Prisma and database implementation.
 */
export interface ITelemetryRepository {
  /**
   * Persists a validated canonical telemetry reading into durable storage.
   * Throws on unhandled database errors or unique constraint conflicts.
   */
  create(data: CreateTelemetryInput): Promise<CanonicalTelemetryReading>;

  /**
   * Finds an existing telemetry reading by the idempotency tuple (wellId, sourceId, sequenceNumber).
   */
  findByWellSourceSequence(
    wellId: string,
    sourceId: string,
    sequenceNumber: number | bigint,
  ): Promise<CanonicalTelemetryReading | null>;

  /**
   * Lists chronological telemetry readings for a well within an optional time range.
   * Supports pagination and ascending/descending ordering by measurement timestamp.
   */
  listByWellId(
    wellId: string,
    criteria?: TelemetryFilterCriteria,
  ): Promise<PaginatedTelemetryResult>;
}
