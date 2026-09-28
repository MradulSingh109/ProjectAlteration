import { z } from "zod";
import {
  EventType,
  EventSeverity,
  VALID_EVENT_TYPES,
  VALID_EVENT_SEVERITIES,
} from "@/domain/events/drilling-event.entity";
import {
  OffsetSortField,
  SortOrder,
  OffsetWellIntelligenceResult,
} from "@/domain/wells/offset-well.entity";

export const OFFSET_SORT_FIELDS: OffsetSortField[] = [
  "distance",
  "relevanceScore",
  "overlapLength",
  "eventCount",
  "name",
];

/**
 * Zod validation schema for offset well discovery query parameters.
 */
export const queryOffsetWellsSchema = z.object({
  radiusKm: z.coerce
    .number({ message: "radiusKm must be a number" })
    .positive("radiusKm must be greater than 0")
    .max(
      100,
      "radiusKm must not exceed maximum operational threshold of 100 km",
    )
    .default(25),
  page: z.coerce
    .number({ message: "page must be a number" })
    .int("page must be an integer")
    .min(1, "page must be at least 1")
    .default(1),
  pageSize: z.coerce
    .number({ message: "pageSize must be a number" })
    .int("pageSize must be an integer")
    .min(1, "pageSize must be at least 1")
    .max(100, "pageSize cannot exceed 100")
    .default(20),
  formation: z.string().trim().min(1).optional(),
  minDepthOverlapMd: z.coerce
    .number({ message: "minDepthOverlapMd must be a number" })
    .min(0, "minDepthOverlapMd must be greater than or equal to 0")
    .optional(),
  minEvents: z.coerce
    .number({ message: "minEvents must be a number" })
    .int("minEvents must be an integer")
    .min(0, "minEvents must be greater than or equal to 0")
    .optional(),
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
  sortBy: z
    .enum(OFFSET_SORT_FIELDS as [OffsetSortField, ...OffsetSortField[]], {
      message: `Invalid sortBy field. Must be one of: ${OFFSET_SORT_FIELDS.join(", ")}`,
    })
    .default("distance"),
  sortOrder: z
    .enum(["asc", "desc"], {
      message: "sortOrder must be either 'asc' or 'desc'",
    })
    .optional(),
});

export type QueryOffsetWellsDto = z.infer<typeof queryOffsetWellsSchema>;

export type OffsetWellResponseDto = OffsetWellIntelligenceResult;
