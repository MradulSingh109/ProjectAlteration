import { IDrillingEventRepository } from "@/domain/events/drilling-event.repository.interface";
import { drillingEventRepository } from "@/infrastructure/events/prisma-drilling-event.repository";
import { IWellRepository } from "@/domain/wells/well.repository.interface";
import { wellRepository } from "@/infrastructure/wells/prisma-well.repository";
import { IDocumentRepository } from "@/domain/documents/document.repository.interface";
import { documentRepository } from "@/infrastructure/documents/prisma-document.repository";
import {
  DrillingEventEntity,
  EventType,
  EventSeverity,
  ReviewStatus,
  VALID_EVENT_TYPES,
  VALID_EVENT_SEVERITIES,
} from "@/domain/events/drilling-event.entity";
import { DocumentType, IngestionStatus } from "@/domain/documents/document.entity";
import {
  DrillingEventResponseDto,
  toDrillingEventResponseDto,
} from "./drilling-event.dto";
import { auditLogger } from "@/infrastructure/audit/audit.logger";
import { AppError } from "@/lib/errors";

export interface MlRawEventInput {
  event_id?: string;
  well_id?: string;
  event_type: string;
  depth_md?: number | string | null;
  depth_tvd?: number | string | null;
  formation?: string | null;
  severity?: string | null;
  description: string;
  cause?: string | null;
  mitigation?: string | null;
  outcome?: string | null;
  source_document?: string;
  source_page?: number | null;
  confidence?: number | null;
  npt_hours?: number | null;
  source_section?: string | null;
  extraction_model?: string | null;
  evidence?: unknown;
}

export interface IngestMlBatchResult {
  totalReceived: number;
  ingestedCount: number;
  skippedDuplicatesCount: number;
  events: DrillingEventResponseDto[];
  warnings: string[];
}

export class MlIngestionService {
  constructor(
    private readonly drillingEventRepo: IDrillingEventRepository = drillingEventRepository,
    private readonly wellRepo: IWellRepository = wellRepository,
    private readonly documentRepo: IDocumentRepository = documentRepository,
  ) {}

  /**
   * Ingests a batch of events produced by the ML pipeline (Roadmap Section 4.1).
   * Resolves human well IDs to database UUIDs, links document filenames to Document records,
   * normalizes fields, defaults missing severities, and eliminates duplicates.
   */
  async ingestMlBatch(
    rawEvents: MlRawEventInput[],
    actorId?: string,
    actorRole?: string,
  ): Promise<IngestMlBatchResult> {
    if (!Array.isArray(rawEvents) || rawEvents.length === 0) {
      throw AppError.badRequest("Batch must contain at least one event");
    }

    const ingestedEvents: DrillingEventResponseDto[] = [];
    const warnings: string[] = [];
    let skippedDuplicates = 0;

    for (const raw of rawEvents) {
      // 1. Validate & Normalize Event Type
      const normalizedEventType = (raw.event_type || "").toUpperCase() as EventType;
      if (!VALID_EVENT_TYPES.includes(normalizedEventType)) {
        warnings.push(`Skipped event ${raw.event_id || "unknown"}: unsupported event type '${raw.event_type}'`);
        continue;
      }

      // 2. Validate & Normalize Severity (Default to MEDIUM if not extracted)
      let normalizedSeverity: EventSeverity = EventSeverity.MEDIUM;
      if (raw.severity) {
        const candidate = raw.severity.toUpperCase() as EventSeverity;
        if (VALID_EVENT_SEVERITIES.includes(candidate)) {
          normalizedSeverity = candidate;
        } else {
          warnings.push(`Event ${raw.event_id || "unknown"}: invalid severity '${raw.severity}', defaulted to MEDIUM`);
        }
      }

      // 3. Resolve Target Well (by well_id string e.g. "OIL-102" or internal UUID)
      const wellIdentifier = (raw.well_id || "").trim();
      if (!wellIdentifier) {
        warnings.push(`Skipped event ${raw.event_id || "unknown"}: missing well_id`);
        continue;
      }

      let well = await this.wellRepo.findByWellId(wellIdentifier);
      if (!well) {
        well = await this.wellRepo.findById(wellIdentifier);
      }
      if (!well) {
        // Automatically register well stub if not yet seeded
        well = await this.wellRepo.create({
          wellId: wellIdentifier,
          name: wellIdentifier,
          field: "Unknown",
          latitude: 0,
          longitude: 0,
          spudDate: null,
          plannedDepthMd: Number(raw.depth_md || 0) + 500,
          plannedDepthTvd: Number(raw.depth_tvd || raw.depth_md || 0) + 500,
          status: "DRILLING" as any,
        });
        warnings.push(`Well '${wellIdentifier}' was not found; automatically registered placeholder master record`);
      }

      // 4. Resolve Source Document (by filename or internal UUID)
      const docFilename = (raw.source_document || "unknown_document.pdf").trim();
      let sourceDoc = await this.documentRepo.findById(docFilename);
      if (!sourceDoc && this.documentRepo.findByWellAndFilename) {
        sourceDoc = await this.documentRepo.findByWellAndFilename(well.id, docFilename);
      }
      if (!sourceDoc) {
        // Derive DocumentType from filename
        let docType: DocumentType = DocumentType.WCR;
        const upper = docFilename.toUpperCase();
        if (upper.includes("DDR")) docType = DocumentType.DDR;
        else if (upper.includes("MUD")) docType = DocumentType.MUD_LOG;
        else if (upper.includes("CEMENT")) docType = DocumentType.CEMENTING_REPORT;
        else if (upper.includes("SURVEY")) docType = DocumentType.WELL_SURVEY;

        sourceDoc = await this.documentRepo.create({
          wellId: well.id,
          filename: docFilename,
          documentType: docType,
          mimeType: "application/pdf",
          fileSize: 0,
          fileHash: `ml-stub-${well.id}-${docFilename}`,
          storageKey: `ml_imports/${well.id}/${docFilename}`,
          uploadedBy: actorId || "ml-pipeline",
          ingestionStatus: IngestionStatus.COMPLETED,
        });
      }

      // 5. Deduplication check via mlEventId
      if (raw.event_id) {
        const existing = await (this.drillingEventRepo as any).findByMlEventId?.(raw.event_id);
        if (existing) {
          skippedDuplicates++;
          continue;
        }
      }

      // 6. Normalize Depths & Confidence
      const depthMd = Number(raw.depth_md || 0);
      const depthTvd = raw.depth_tvd !== undefined && raw.depth_tvd !== null ? Number(raw.depth_tvd) : null;
      const confidence = raw.confidence !== undefined && raw.confidence !== null ? Math.min(Math.max(Number(raw.confidence), 0), 1) : 0.85;

      // 7. Persist Candidate Event with PENDING_REVIEW
      const created = await this.drillingEventRepo.create({
        wellId: well.id,
        eventType: normalizedEventType,
        depthMd,
        depthTvd,
        formation: raw.formation || null,
        severity: normalizedSeverity,
        description: raw.description || `${normalizedEventType} reported at ${depthMd}m`,
        cause: raw.cause || null,
        mitigation: raw.mitigation || null,
        outcome: raw.outcome || null,
        sourceDocumentId: sourceDoc.id,
        sourcePage: raw.source_page && raw.source_page >= 1 ? raw.source_page : 1,
        extractionConfidence: confidence,
        reviewStatus: ReviewStatus.PENDING_REVIEW,
        nptHours: raw.npt_hours !== undefined && raw.npt_hours !== null ? Number(raw.npt_hours) : null,
        sourceSection: raw.source_section || null,
        extractionModel: raw.extraction_model || "nwis-ml-pipeline",
        evidence: raw.evidence || null,
        mlEventId: raw.event_id || null,
      });

      auditLogger.log({
        actorId: actorId || "ml-system",
        actorRole: actorRole || "SYSTEM",
        action: "EVENT_CREATE",
        resourceId: created.id,
        wellId: well.id,
        details: {
          mlEventId: raw.event_id,
          eventType: created.eventType,
          sourceDocument: docFilename,
          ingestionSource: "ML_PIPELINE",
        },
      });

      ingestedEvents.push(toDrillingEventResponseDto(created));
    }

    return {
      totalReceived: rawEvents.length,
      ingestedCount: ingestedEvents.length,
      skippedDuplicatesCount: skippedDuplicates,
      events: ingestedEvents,
      warnings,
    };
  }
}

export const mlIngestionService = new MlIngestionService();
