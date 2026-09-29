import { z } from "zod";
import {
  DrillingEventEntity,
  EventType,
  EventSeverity,
  ReviewStatus,
  VALID_EVENT_TYPES,
  VALID_EVENT_SEVERITIES,
  VALID_REVIEW_STATUSES,
} from "@/domain/events/drilling-event.entity";
import {
  EventSortField,
  PaginationMeta,
} from "@/domain/events/drilling-event.repository.interface";

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
  nptHours: z.number().min(0, "NPT hours cannot be negative").optional().nullable(),
  sourceSection: z.string().trim().optional().nullable(),
  extractionModel: z.string().trim().optional().nullable(),
  evidence: z.any().optional().nullable(),
  mlEventId: z.string().trim().optional().nullable(),
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

export const EVENT_SORT_FIELDS: EventSortField[] = [
  "depthMd",
  "depthTvd",
  "severity",
  "eventType",
  "reviewStatus",
  "extractionConfidence",
  "createdAt",
  "sourcePage",
];

/**
 * Zod schema for validated drilling event querying, filtering, sorting, and pagination.
 */
export const queryDrillingEventsSchema = z
  .object({
    page: z.coerce
      .number({ message: "Page must be a number" })
      .int("Page must be an integer")
      .min(1, "Page must be greater than or equal to 1")
      .default(1),
    pageSize: z.coerce
      .number({ message: "PageSize must be a number" })
      .int("PageSize must be an integer")
      .min(1, "PageSize must be at least 1")
      .max(100, "PageSize cannot exceed 100")
      .default(20),
    eventType: z
      .enum(VALID_EVENT_TYPES as [EventType, ...EventType[]], {
        message: `Invalid eventType. Must be one of: ${VALID_EVENT_TYPES.join(", ")}`,
      })
      .optional(),
    severity: z
      .enum(VALID_EVENT_SEVERITIES as [EventSeverity, ...EventSeverity[]], {
        message: `Invalid severity. Must be one of: ${VALID_EVENT_SEVERITIES.join(", ")}`,
      })
      .optional(),
    reviewStatus: z
      .enum(VALID_REVIEW_STATUSES as [ReviewStatus, ...ReviewStatus[]], {
        message: `Invalid reviewStatus. Must be one of: ${VALID_REVIEW_STATUSES.join(", ")}`,
      })
      .optional(),
    formation: z.string().trim().min(1).optional(),
    minDepthMd: depthValidator.optional(),
    maxDepthMd: depthValidator.optional(),
    minDepthTvd: depthValidator.optional(),
    maxDepthTvd: depthValidator.optional(),
    minConfidence: z.coerce
      .number({ message: "minConfidence must be a number" })
      .min(0, "minConfidence must be between 0.0 and 1.0")
      .max(1, "minConfidence must be between 0.0 and 1.0")
      .optional(),
    maxConfidence: z.coerce
      .number({ message: "maxConfidence must be a number" })
      .min(0, "maxConfidence must be between 0.0 and 1.0")
      .max(1, "maxConfidence must be between 0.0 and 1.0")
      .optional(),
    sourceDocumentId: z.string().trim().min(1).optional(),
    sortBy: z
      .enum(EVENT_SORT_FIELDS as [EventSortField, ...EventSortField[]], {
        message: `Invalid sortBy field. Must be one of: ${EVENT_SORT_FIELDS.join(", ")}`,
      })
      .default("createdAt"),
    sortOrder: z
      .enum(["asc", "desc"], {
        message: "sortOrder must be either 'asc' or 'desc'",
      })
      .default("desc"),
  })
  .refine(
    (data) => {
      if (data.minDepthMd !== undefined && data.maxDepthMd !== undefined) {
        return data.minDepthMd <= data.maxDepthMd;
      }
      return true;
    },
    {
      message: "minDepthMd cannot be greater than maxDepthMd",
      path: ["minDepthMd"],
    },
  )
  .refine(
    (data) => {
      if (data.minDepthTvd !== undefined && data.maxDepthTvd !== undefined) {
        return data.minDepthTvd <= data.maxDepthTvd;
      }
      return true;
    },
    {
      message: "minDepthTvd cannot be greater than maxDepthTvd",
      path: ["minDepthTvd"],
    },
  )
  .refine(
    (data) => {
      if (
        data.minConfidence !== undefined &&
        data.maxConfidence !== undefined
      ) {
        return data.minConfidence <= data.maxConfidence;
      }
      return true;
    },
    {
      message: "minConfidence cannot be greater than maxConfidence",
      path: ["minConfidence"],
    },
  );

export type QueryDrillingEventsDto = z.infer<typeof queryDrillingEventsSchema>;

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
  nptHours?: number | null;
  sourceSection?: string | null;
  extractionModel?: string | null;
  evidence?: unknown;
  mlEventId?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Detailed event response DTO including safe source document provenance and well metadata.
 * SECURITY: Never exposes physical storageKey, filesystem paths, or credentials.
 */
export interface DrillingEventDetailResponseDto extends DrillingEventResponseDto {
  well?: {
    id: string;
    wellId: string;
    name: string;
    field: string;
  };
  sourceDocument: {
    id: string;
    filename: string;
    mimeType: string;
    documentType: string;
    fileSize?: number;
    fileHash?: string;
    uploadedAt?: string;
    ingestionStatus?: string;
  };
}

export type PaginationDto = PaginationMeta;

export interface PaginatedEventsResponseDto {
  items: DrillingEventResponseDto[];
  events: DrillingEventResponseDto[];
  pagination: PaginationDto;
}

export interface WellEventSummaryResponseDto {
  wellId: string;
  totalEvents: number;
  byEventType: Record<string, number>;
  bySeverity: Record<string, number>;
  byReviewStatus: Record<string, number>;
  byFormation: Record<string, number>;
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
    nptHours: entity.nptHours ?? null,
    sourceSection: entity.sourceSection ?? null,
    extractionModel: entity.extractionModel ?? null,
    evidence: entity.evidence ?? null,
    mlEventId: entity.mlEventId ?? null,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}
