import { z } from "zod";
import {
  CanonicalTelemetryReading,
  TelemetryMeasurements,
} from "@/domain/telemetry/telemetry.entity";

/**
 * Strict numeric validator for physical measurements.
 * Rejects NaN, Infinity, -Infinity, negative numbers, and non-numeric values.
 */
const nonNegativeFiniteNumber = z
  .number({
    message: "Measurement value must be a number",
  })
  .refine((val) => Number.isFinite(val), {
    message: "Measurement value cannot be NaN or Infinity",
  })
  .refine((val) => val >= 0, {
    message: "Measurement value must be greater than or equal to 0",
  });

/**
 * Measurements sub-schema validating all standardized drilling parameters.
 */
export const telemetryMeasurementsSchema = z.object({
  depthMd: nonNegativeFiniteNumber,
  depthTvd: nonNegativeFiniteNumber.optional().nullable(),
  rateOfPenetration: nonNegativeFiniteNumber.optional().nullable(),
  hookLoad: nonNegativeFiniteNumber.optional().nullable(),
  standpipePressure: nonNegativeFiniteNumber.optional().nullable(),
  annularPressure: nonNegativeFiniteNumber.optional().nullable(),
  surfaceTorque: nonNegativeFiniteNumber.optional().nullable(),
  rotaryRpm: nonNegativeFiniteNumber.optional().nullable(),
  flowRateIn: nonNegativeFiniteNumber.optional().nullable(),
  flowRateOut: nonNegativeFiniteNumber.optional().nullable(),
  mudDensity: nonNegativeFiniteNumber.optional().nullable(),
});

/**
 * Strict ISO 8601 UTC timestamp validator.
 */
const isoTimestampValidator = z
  .string({
    message: "timestamp must be a valid ISO 8601 string",
  })
  .trim()
  .datetime({
    message:
      "timestamp must be a valid ISO 8601 UTC datetime string (e.g. 2026-09-28T12:00:00Z)",
  })
  .transform((val) => new Date(val));

/**
 * Ingestion request payload schema.
 */
export const ingestTelemetrySchema = z.object({
  wellId: z.string().uuid("wellId must be a valid UUID"),
  sourceId: z
    .string()
    .trim()
    .min(1, "sourceId is required")
    .max(100, "sourceId cannot exceed 100 characters"),
  sequenceNumber: z
    .union([
      z.number().int("sequenceNumber must be an integer"),
      z
        .string()
        .trim()
        .regex(/^\d+$/, "sequenceNumber must be a positive integer"),
    ])
    .transform((val) => Number(val))
    .refine((val) => Number.isSafeInteger(val) && val >= 0, {
      message: "sequenceNumber must be a valid non-negative integer",
    }),
  timestamp: isoTimestampValidator,
  measurements: telemetryMeasurementsSchema,
  metadata: z
    .record(z.string(), z.unknown())
    .optional()
    .nullable()
    .refine(
      (val) => {
        if (!val) return true;
        // Basic payload guard: verify serialized metadata is <= 64KB
        return JSON.stringify(val).length <= 65536;
      },
      { message: "metadata payload exceeds maximum allowed size (64KB)" },
    ),
});

export type IngestTelemetryDto = z.infer<typeof ingestTelemetrySchema>;

/**
 * Query schema for retrieving time-series telemetry for a well.
 */
export const queryTelemetrySchema = z
  .object({
    from: z
      .string()
      .trim()
      .datetime({ message: "from must be a valid ISO 8601 datetime string" })
      .optional()
      .transform((val) => (val ? new Date(val) : undefined)),
    to: z
      .string()
      .trim()
      .datetime({ message: "to must be a valid ISO 8601 datetime string" })
      .optional()
      .transform((val) => (val ? new Date(val) : undefined)),
    page: z.coerce
      .number()
      .int("page must be an integer")
      .min(1, "page must be greater than or equal to 1")
      .default(1),
    pageSize: z.coerce
      .number()
      .int("pageSize must be an integer")
      .min(1, "pageSize must be greater than or equal to 1")
      .max(200, "pageSize cannot exceed 200")
      .default(50),
    sortOrder: z.enum(["asc", "desc"]).default("asc"),
  })
  .refine(
    (data) => {
      if (data.from && data.to && data.from.getTime() > data.to.getTime()) {
        return false;
      }
      return true;
    },
    {
      message: "from date must be earlier than or equal to to date",
      path: ["from"],
    },
  );

export type QueryTelemetryDto = z.infer<typeof queryTelemetrySchema>;

/**
 * Canonical telemetry response DTO returned to API consumers.
 */
export interface TelemetryReadingResponseDto {
  id: string;
  wellId: string;
  sourceId: string;
  sequenceNumber: number;
  timestamp: string;
  measurements: TelemetryMeasurements;
  metadata?: Record<string, unknown> | null;
  ingestedAt: string;
  createdAt: string;
}

/**
 * Transforms domain canonical entity to API response DTO.
 */
export function toTelemetryResponseDto(
  reading: CanonicalTelemetryReading,
): TelemetryReadingResponseDto {
  return {
    id: reading.id,
    wellId: reading.wellId,
    sourceId: reading.sourceId,
    sequenceNumber: reading.sequenceNumber,
    timestamp: reading.timestamp.toISOString(),
    measurements: reading.measurements,
    metadata: reading.metadata,
    ingestedAt: reading.ingestedAt.toISOString(),
    createdAt: reading.createdAt.toISOString(),
  };
}
