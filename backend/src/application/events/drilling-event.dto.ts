import { z } from "zod";
import {
  DrillingEventEntity,
  EventType,
  EventSeverity,
  ReviewStatus,
  VALID_EVENT_TYPES,
  VALID_EVENT_SEVERITIES,
} from "@/domain/events/drilling-event.entity";

/**
 * Depth numeric validator accepting numbers or numeric strings >= 0.
 */
const depthValidator = z
  .union([
    z.number().min(0, "Depth cannot be negative"),
    z
      .string()
      .trim()
      .regex(
        /^\d+(\.\d+)?$/,
        "Depth must be a valid non-negative decimal number",
      )
      .transform((val) => Number(val)),
  ])
  .refine((val) => !isNaN(val) && val >= 0, {
    message: "Depth must be greater than or equal to 0",
  });

/**
 * Zod schema for validating candidate drilling event creation.
 */
export const createDrillingEventSchema = z.object({
  eventType: z.enum(VALID_EVENT_TYPES as [EventType, ...EventType[]], {
    message: `Invalid eventType. Must be one of: ${VALID_EVENT_TYPES.join(", ")}`,
  }),
  severity: z.enum(
    VALID_EVENT_SEVERITIES as [EventSeverity, ...EventSeverity[]],
    {
      message: `Invalid severity. Must be one of: ${VALID_EVENT_SEVERITIES.join(", ")}`,
    },
  ),
  depthMd: depthValidator,
  depthTvd: depthValidator.optional().nullable(),
  formation: z.string().trim().min(1).max(200).optional().nullable(),
  description: z.string().trim().min(1, "Description is required"),
  cause: z.string().trim().optional().nullable(),
  mitigation: z.string().trim().optional().nullable(),
  outcome: z.string().trim().optional().nullable(),
  sourceDocumentId: z.string().trim().min(1, "sourceDocumentId is required"),
  sourcePage: z
    .number()
    .int("sourcePage must be an integer")
    .min(1, "sourcePage must be greater than or equal to 1"),
  extractionConfidence: z
    .number()
    .min(0, "extractionConfidence must be between 0.0 and 1.0")
    .max(1, "extractionConfidence must be between 0.0 and 1.0"),
});

export type CreateDrillingEventDto = z.infer<typeof createDrillingEventSchema>;

/**
 * Schema for edited fields when a reviewer corrects event data.
 */
export const editedEventFieldsSchema = z.object({
  eventType: z
    .enum(VALID_EVENT_TYPES as [EventType, ...EventType[]])
    .optional(),
  severity: z
    .enum(VALID_EVENT_SEVERITIES as [EventSeverity, ...EventSeverity[]])
    .optional(),
  depthMd: depthValidator.optional(),
  depthTvd: depthValidator.optional().nullable(),
  formation: z.string().trim().min(1).max(200).optional().nullable(),
  description: z.string().trim().min(1).optional(),
  cause: z.string().trim().optional().nullable(),
  mitigation: z.string().trim().optional().nullable(),
  outcome: z.string().trim().optional().nullable(),
  sourceDocumentId: z
    .string()
    .trim()
    .min(1, "sourceDocumentId cannot be empty")
    .optional(),
  sourcePage: z
    .number()
    .int("sourcePage must be an integer")
    .min(1, "sourcePage must be greater than or equal to 1")
    .optional(),
  extractionConfidence: z
    .number()
    .min(0, "extractionConfidence must be between 0.0 and 1.0")
    .max(1, "extractionConfidence must be between 0.0 and 1.0")
    .optional(),
});

/**
 * Schema for human review decision submission.
 */
export const reviewDrillingEventSchema = z.object({
  action: z.enum(["APPROVE", "EDIT", "INVALIDATE"], {
    message: "Action must be APPROVE, EDIT, or INVALIDATE",
  }),
  editedFields: editedEventFieldsSchema.optional(),
});

export type ReviewDrillingEventDto = z.infer<typeof reviewDrillingEventSchema>;

/**
 * Safe client-facing response DTO for a drilling event.
 */
export interface DrillingEventResponseDto {
  id: string;
  wellId: string;
  eventType: EventType;
  depthMd: number;
  depthTvd: number | null;
  formation: string | null;
  severity: EventSeverity;
  description: string;
  cause: string | null;
  mitigation: string | null;
  outcome: string | null;
  sourceDocumentId: string;
  sourcePage: number;
  extractionConfidence: number;
  reviewStatus: ReviewStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Detailed event response DTO including safe source document provenance metadata.
 */
export interface DrillingEventDetailResponseDto extends DrillingEventResponseDto {
  sourceDocument: {
    id: string;
    filename: string;
    mimeType: string;
    documentType: string;
  };
}

export function toDrillingEventResponseDto(
  entity: DrillingEventEntity,
): DrillingEventResponseDto {
  return {
    id: entity.id,
    wellId: entity.wellId,
    eventType: entity.eventType,
    depthMd: entity.depthMd,
    depthTvd: entity.depthTvd,
    formation: entity.formation,
    severity: entity.severity,
    description: entity.description,
    cause: entity.cause,
    mitigation: entity.mitigation,
    outcome: entity.outcome,
    sourceDocumentId: entity.sourceDocumentId,
    sourcePage: entity.sourcePage,
    extractionConfidence: entity.extractionConfidence,
    reviewStatus: entity.reviewStatus,
    reviewedBy: entity.reviewedBy,
    reviewedAt: entity.reviewedAt ? entity.reviewedAt.toISOString() : null,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}
