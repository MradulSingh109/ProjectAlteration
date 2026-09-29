import { ITelemetryRepository } from "@/domain/telemetry/telemetry.repository.interface";
import { telemetryRepository } from "@/infrastructure/telemetry/prisma-telemetry.repository";
import { IWellRepository } from "@/domain/wells/well.repository.interface";
import { wellRepository } from "@/infrastructure/wells/prisma-well.repository";
import { IAuditLogRepository } from "@/domain/audit/audit-log.repository.interface";
import { auditLogRepository } from "@/infrastructure/audit/prisma-audit-log.repository";
import { ITelemetrySourceAdapter } from "@/domain/telemetry/telemetry-adapter.interface";
import { httpTelemetryAdapter } from "@/infrastructure/telemetry/http-telemetry.adapter";
import {
  CreateTelemetryInput,
  IngestTelemetryResult,
  PaginatedTelemetryResult,
} from "@/domain/telemetry/telemetry.entity";
import { queryTelemetrySchema } from "./telemetry.dto";
import { AppError } from "@/lib/errors";
import { Prisma } from "@prisma/client";

/**
 * Application service orchestrating telemetry validation, idempotency enforcement,
 * persistence, audit logging, and chronological time-series retrieval.
 */
export class TelemetryIngestionService {
  constructor(
    private readonly telemetryRepo: ITelemetryRepository = telemetryRepository,
    private readonly wellRepo: IWellRepository = wellRepository,
    private readonly auditLogRepo: IAuditLogRepository = auditLogRepository,
    private readonly adapter: ITelemetrySourceAdapter = httpTelemetryAdapter,
  ) {}

  /**
   * Ingests a raw transport payload through the configured adapter.
   */
  async ingest(rawPayload: unknown): Promise<IngestTelemetryResult> {
    const canonicalInput = await this.adapter.adapt(rawPayload);
    return this.ingestCanonical(canonicalInput);
  }

  /**
   * Ingests a canonical telemetry reading with idempotency and well validation.
   */
  async ingestCanonical(
    input: CreateTelemetryInput,
  ): Promise<IngestTelemetryResult> {
    // 1. Verify target well exists
    const well = await this.wellRepo.findById(input.wellId);
    if (!well) {
      throw AppError.notFound("Well not found");
    }

    // 2. Check for pre-existing record (idempotency check)
    const existing = await this.telemetryRepo.findByWellSourceSequence(
      input.wellId,
      input.sourceId,
      input.sequenceNumber,
    );

    if (existing) {
      return {
        status: "ALREADY_INGESTED",
        isDuplicate: true,
        reading: existing,
      };
    }

    // 3. Persist with database-level race condition protection
    try {
      const created = await this.telemetryRepo.create(input);

      // 4. Log durable audit record (never log sensitive secrets or credentials)
      try {
        await this.auditLogRepo.create({
          actorId: input.sourceId,
          actorRole: "MACHINE_TELEMETRY_SOURCE",
          action: "TELEMETRY_INGEST",
          resourceType: "TELEMETRY_READING",
          resourceId: created.id,
          wellId: input.wellId,
          details: {
            sourceId: input.sourceId,
            sequenceNumber: Number(input.sequenceNumber),
            timestamp: input.timestamp.toISOString(),
            isDuplicate: false,
          },
        });
      } catch (auditErr) {
        console.warn("Failed to create telemetry audit record:", auditErr);
      }

      return {
        status: "INGESTED",
        isDuplicate: false,
        reading: created,
      };
    } catch (error: unknown) {
      // Handle unique constraint conflict from concurrent racing ingestion
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const raceExisting = await this.telemetryRepo.findByWellSourceSequence(
          input.wellId,
          input.sourceId,
          input.sequenceNumber,
        );

        if (raceExisting) {
          return {
            status: "ALREADY_INGESTED",
            isDuplicate: true,
            reading: raceExisting,
          };
        }
      }

      throw error;
    }
  }

  /**
   * Queries chronological telemetry readings for a well within a validated time range.
   */
  async queryTelemetry(
    wellId: string,
    queryParams: unknown,
  ): Promise<PaginatedTelemetryResult> {
    // 1. Verify target well exists
    const well = await this.wellRepo.findById(wellId);
    if (!well) {
      throw AppError.notFound("Well not found");
    }

    // 2. Validate query parameters
    const parsed = queryTelemetrySchema.safeParse(queryParams);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const message = issue
        ? `${issue.path.join(".") || "query"}: ${issue.message}`
        : "Invalid query parameters";
      throw AppError.validation(message, parsed.error.issues);
    }

    const criteria = parsed.data;

    // 3. Query repository
    return this.telemetryRepo.listByWellId(wellId, criteria);
  }
}

export const telemetryIngestionService = new TelemetryIngestionService();
