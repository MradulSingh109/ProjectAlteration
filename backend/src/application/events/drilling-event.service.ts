import {
  IDrillingEventRepository,
  ListDrillingEventsFilter,
} from "@/domain/events/drilling-event.repository.interface";
import { drillingEventRepository } from "@/infrastructure/events/prisma-drilling-event.repository";
import { IWellRepository } from "@/domain/wells/well.repository.interface";
import { wellRepository } from "@/infrastructure/wells/prisma-well.repository";
import { IDocumentRepository } from "@/domain/documents/document.repository.interface";
import { documentRepository } from "@/infrastructure/documents/prisma-document.repository";
import { IAuditLogRepository } from "@/domain/audit/audit-log.repository.interface";
import { auditLogRepository } from "@/infrastructure/audit/prisma-audit-log.repository";
import {
  DrillingEventEntity,
  ReviewStatus,
} from "@/domain/events/drilling-event.entity";
import {
  createDrillingEventSchema,
  reviewDrillingEventSchema,
  DrillingEventResponseDto,
  DrillingEventDetailResponseDto,
  toDrillingEventResponseDto,
} from "./drilling-event.dto";
import { auditLogger } from "@/infrastructure/audit/audit.logger";
import { AppError } from "@/lib/errors";

/**
 * Application service managing drilling event ingestion, provenance integrity,
 * and human review workflow state machine.
 */
export class DrillingEventService {
  constructor(
    private readonly drillingEventRepo: IDrillingEventRepository = drillingEventRepository,
    private readonly wellRepo: IWellRepository = wellRepository,
    private readonly documentRepo: IDocumentRepository = documentRepository,
    private readonly auditLogRepo: IAuditLogRepository = auditLogRepository,
  ) {}

  /**
   * Ingests a new candidate drilling operational event.
   *
   * Enforces:
   * - Target well existence
   * - Source document existence and strict well-consistency (provenance)
   * - Initial review status strictly pinned to PENDING_REVIEW
   */
  async createCandidateEvent(
    wellId: string,
    input: unknown,
    actorId?: string,
    actorRole?: string,
  ): Promise<DrillingEventResponseDto> {
    // 1. Verify target well exists
    const well = await this.wellRepo.findById(wellId);
    if (!well) {
      throw AppError.notFound("Well not found");
    }

    // 2. Validate input schema
    const parsed = createDrillingEventSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation(
        parsed.error.issues[0]?.message || "Invalid drilling event data",
      );
    }
    const data = parsed.data;

    // 3. Provenance Check: Verify source document exists and belongs strictly to this well
    const sourceDoc = await this.documentRepo.findById(data.sourceDocumentId);
    if (!sourceDoc) {
      throw AppError.notFound("Source document not found");
    }

    if (sourceDoc.wellId !== wellId) {
      throw AppError.validation(
        "Provenance mismatch: Source document belongs to a different well",
      );
    }

    // 4. Persist candidate event with PENDING_REVIEW state
    const createdEvent = await this.drillingEventRepo.create({
      wellId,
      eventType: data.eventType,
      depthMd: data.depthMd,
      depthTvd: data.depthTvd ?? null,
      formation: data.formation ?? null,
      severity: data.severity,
      description: data.description,
      cause: data.cause ?? null,
      mitigation: data.mitigation ?? null,
      outcome: data.outcome ?? null,
      sourceDocumentId: data.sourceDocumentId,
      sourcePage: data.sourcePage,
      extractionConfidence: data.extractionConfidence,
      reviewStatus: ReviewStatus.PENDING_REVIEW,
      reviewedBy: null,
      reviewedAt: null,
    });

    // 5. Durably record audit history in database
    await this.auditLogRepo.create({
      actorId: actorId ?? null,
      actorRole: actorRole ?? null,
      action: "EVENT_CREATE",
      resourceType: "DRILLING_EVENT",
      resourceId: createdEvent.id,
      wellId,
      details: {
        eventType: createdEvent.eventType,
        severity: createdEvent.severity,
        depthMd: createdEvent.depthMd,
        sourceDocumentId: createdEvent.sourceDocumentId,
        sourcePage: createdEvent.sourcePage,
      },
    });

    // 6. Emit structured application log
    auditLogger.log({
      action: "EVENT_CREATE",
      actorId,
      actorRole,
      resourceId: createdEvent.id,
      wellId,
      details: {
        eventType: createdEvent.eventType,
        severity: createdEvent.severity,
        depthMd: createdEvent.depthMd,
        sourceDocumentId: createdEvent.sourceDocumentId,
        sourcePage: createdEvent.sourcePage,
      },
    });

    return toDrillingEventResponseDto(createdEvent);
  }

  /**
   * Lists drilling events associated with a specific well.
   */
  async listEventsByWell(
    wellId: string,
    filter?: ListDrillingEventsFilter,
  ): Promise<DrillingEventResponseDto[]> {
    const well = await this.wellRepo.findById(wellId);
    if (!well) {
      throw AppError.notFound("Well not found");
    }

    const events = await this.drillingEventRepo.listByWellId(wellId, filter);
    return events.map(toDrillingEventResponseDto);
  }

  /**
   * Retrieves single event details with source document provenance metadata.
   */
  async getEventDetail(
    eventId: string,
    actorId?: string,
  ): Promise<DrillingEventDetailResponseDto> {
    const result = await this.drillingEventRepo.findByIdWithSource(eventId);
    if (!result) {
      throw AppError.notFound("Drilling event not found");
    }

    return {
      ...toDrillingEventResponseDto(result.event),
      sourceDocument: result.sourceDocument,
    };
  }

  /**
   * Processes a human review decision adhering strictly to state machine rules.
   *
   * Workflow Rules:
   * - Only events in PENDING_REVIEW may undergo review.
   * - Actions map deterministically: APPROVE -> APPROVED, EDIT -> EDITED, INVALIDATE -> INVALIDATED.
   * - INVALIDATE does not delete the event, preserving full audit history.
   * - Reviewer identity is bound exclusively from the authenticated user.
   */
  async reviewEvent(
    eventId: string,
    rawInput: unknown,
    reviewerId: string,
    reviewerRole?: string,
  ): Promise<DrillingEventResponseDto> {
    // 1. Validate review payload
    const parsed = reviewDrillingEventSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw AppError.validation(
        parsed.error.issues[0]?.message || "Invalid review payload",
      );
    }
    const { action, editedFields } = parsed.data;

    // 2. Fetch target event
    const event = await this.drillingEventRepo.findById(eventId);
    if (!event) {
      throw AppError.notFound("Drilling event not found");
    }

    // 3. State Machine Check: Cannot transition an event that has already been reviewed
    if (event.reviewStatus !== ReviewStatus.PENDING_REVIEW) {
      throw AppError.badRequest(
        `Event has already been reviewed (current status: '${event.reviewStatus}') and cannot be modified`,
      );
    }

    const reviewedAt = new Date();
    let updatedEvent: DrillingEventEntity;

    if (action === "APPROVE") {
      updatedEvent = await this.drillingEventRepo.update(eventId, {
        reviewStatus: ReviewStatus.APPROVED,
        reviewedBy: reviewerId,
        reviewedAt,
      });

      // Durably record approval audit
      await this.auditLogRepo.create({
        actorId: reviewerId,
        actorRole: reviewerRole ?? null,
        action: "EVENT_APPROVE",
        resourceType: "DRILLING_EVENT",
        resourceId: eventId,
        wellId: event.wellId,
        details: {},
      });

      auditLogger.log({
        action: "EVENT_APPROVE",
        actorId: reviewerId,
        actorRole: reviewerRole,
        resourceId: eventId,
        wellId: event.wellId,
      });
    } else if (action === "EDIT") {
      if (!editedFields || Object.keys(editedFields).length === 0) {
        throw AppError.validation(
          "editedFields with at least one modified property is required when action is EDIT",
        );
      }

      // If sourceDocumentId is modified during review, re-verify provenance
      if (
        editedFields.sourceDocumentId &&
        editedFields.sourceDocumentId !== event.sourceDocumentId
      ) {
        const newSourceDoc = await this.documentRepo.findById(
          editedFields.sourceDocumentId,
        );
        if (!newSourceDoc) {
          throw AppError.notFound("New source document not found");
        }
        if (newSourceDoc.wellId !== event.wellId) {
          throw AppError.validation(
            "Provenance mismatch: New source document belongs to a different well",
          );
        }
      }

      updatedEvent = await this.drillingEventRepo.update(eventId, {
        ...editedFields,
        reviewStatus: ReviewStatus.EDITED,
        reviewedBy: reviewerId,
        reviewedAt,
      });

      // Durably record edit audit
      await this.auditLogRepo.create({
        actorId: reviewerId,
        actorRole: reviewerRole ?? null,
        action: "EVENT_EDIT",
        resourceType: "DRILLING_EVENT",
        resourceId: eventId,
        wellId: event.wellId,
        details: { editedFields },
      });

      auditLogger.log({
        action: "EVENT_EDIT",
        actorId: reviewerId,
        actorRole: reviewerRole,
        resourceId: eventId,
        wellId: event.wellId,
        details: { editedFields },
      });
    } else if (action === "INVALIDATE") {
      // Invalidation marks the event invalid while preserving record and evidence
      updatedEvent = await this.drillingEventRepo.update(eventId, {
        reviewStatus: ReviewStatus.INVALIDATED,
        reviewedBy: reviewerId,
        reviewedAt,
      });

      // Durably record invalidation audit
      await this.auditLogRepo.create({
        actorId: reviewerId,
        actorRole: reviewerRole ?? null,
        action: "EVENT_INVALIDATE",
        resourceType: "DRILLING_EVENT",
        resourceId: eventId,
        wellId: event.wellId,
        details: {},
      });

      auditLogger.log({
        action: "EVENT_INVALIDATE",
        actorId: reviewerId,
        actorRole: reviewerRole,
        resourceId: eventId,
        wellId: event.wellId,
      });
    } else {
      throw AppError.validation("Unsupported review action");
    }

    return toDrillingEventResponseDto(updatedEvent);
  }
}

export const drillingEventService = new DrillingEventService();
