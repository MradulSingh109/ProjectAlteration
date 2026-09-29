import { z } from "zod";

/**
 * Valid well statuses
 */
export const WELL_STATUS_VALUES = [
  "PLANNED",
  "DRILLING",
  "COMPLETED",
  "ABANDONED",
] as const;

/**
 * Reusable validator for non-negative depth decimal values (accepts numbers or valid decimal strings).
 */
export const depthDecimalValidator = (fieldName: string) =>
  z
    .union([
      z.number({ message: `${fieldName} must be a number` }),
      z.string({
        message: `${fieldName} must be a valid decimal number or string`,
      }),
    ])
    .refine(
      (val) => {
        const num = Number(val);
        return !isNaN(num) && num >= 0;
      },
      { message: `${fieldName} cannot be negative` },
    )
    .transform((val) => (typeof val === "number" ? val : Number(val)));

/**
 * Validation schema for Well creation.
 */
export const CreateWellSchema = z.object({
  wellId: z
    .string()
    .min(1, "Well ID is required")
    .max(50, "Well ID must not exceed 50 characters")
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "Well ID may only contain alphanumeric characters, hyphens, and underscores",
    )
    .transform((val) => val.trim()),
  name: z
    .string()
    .min(1, "Well name is required")
    .max(120, "Well name must not exceed 120 characters")
    .transform((val) => val.trim()),
  field: z
    .string()
    .min(1, "Field name is required")
    .max(100, "Field name must not exceed 100 characters")
    .transform((val) => val.trim()),
  latitude: z
    .number({ message: "Latitude must be a valid number" })
    .min(-90, "Latitude must be between -90 and +90 degrees")
    .max(90, "Latitude must be between -90 and +90 degrees"),
  longitude: z
    .number({ message: "Longitude must be a valid number" })
    .min(-180, "Longitude must be between -180 and +180 degrees")
    .max(180, "Longitude must be between -180 and +180 degrees"),
  spudDate: z
    .string()
    .datetime({ message: "spudDate must be a valid ISO-8601 datetime string" })
    .nullable()
    .optional()
    .transform((val) => {
      if (val === undefined || val === null) return null;
      return new Date(val);
    }),
  plannedDepthMd: depthDecimalValidator("Planned measured depth (MD)"),
  plannedDepthTvd: depthDecimalValidator("Planned true vertical depth (TVD)"),
  status: z
    .enum(WELL_STATUS_VALUES, {
      message:
        "Invalid well status. Must be PLANNED, DRILLING, COMPLETED, or ABANDONED",
    })
    .default("PLANNED"),
});

export type CreateWellInput = z.infer<typeof CreateWellSchema>;

/**
 * Validation schema for Well modification.
 * Note: wellId is immutable after creation to maintain business integrity.
 */
export const UpdateWellSchema = z.object({
  name: z
    .string()
    .min(1, "Well name cannot be empty")
    .max(120)
    .transform((val) => val.trim())
    .optional(),
  field: z
    .string()
    .min(1, "Field name cannot be empty")
    .max(100)
    .transform((val) => val.trim())
    .optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  spudDate: z
    .string()
    .datetime()
    .nullable()
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      if (val === null) return null;
      return new Date(val);
    }),
  plannedDepthMd: depthDecimalValidator(
    "Planned measured depth (MD)",
  ).optional(),
  plannedDepthTvd: depthDecimalValidator(
    "Planned true vertical depth (TVD)",
  ).optional(),
  status: z.enum(WELL_STATUS_VALUES).optional(),
});

export type UpdateWellInput = z.infer<typeof UpdateWellSchema>;

/**
 * Query schema for listing wells with optional field and status filters, and bounded pagination.
 */
export const QueryWellsSchema = z.object({
  field: z
    .string()
    .trim()
    .max(100, "Field filter must not exceed 100 characters")
    .optional(),
  status: z
    .enum(WELL_STATUS_VALUES, {
      message: `Invalid well status. Must be one of: ${WELL_STATUS_VALUES.join(", ")}`,
    })
    .optional(),
  limit: z.coerce
    .number({ message: "limit must be a number" })
    .int("limit must be an integer")
    .min(1, "limit must be at least 1")
    .max(100, "limit cannot exceed 100")
    .optional(),
  offset: z.coerce
    .number({ message: "offset must be a number" })
    .int("offset must be an integer")
    .min(0, "offset must be greater than or equal to 0")
    .optional(),
});

export type QueryWellsInput = z.infer<typeof QueryWellsSchema>;

/**
 * Query schema for spatial proximity searches.
 */
export const NearbyWellQuerySchema = z.object({
  latitude: z.coerce
    .number({ message: "Latitude must be a valid number" })
    .min(-90, "Latitude must be between -90 and +90 degrees")
    .max(90, "Latitude must be between -90 and +90 degrees"),
  longitude: z.coerce
    .number({ message: "Longitude must be a valid number" })
    .min(-180, "Longitude must be between -180 and +180 degrees")
    .max(180, "Longitude must be between -180 and +180 degrees"),
  radiusKm: z.coerce
    .number({ message: "radiusKm must be a number" })
    .min(0.01, "radiusKm must be greater than 0")
    .max(50, "radiusKm must not exceed maximum operational threshold of 50 km")
    .default(10),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export type NearbyWellQuery = z.infer<typeof NearbyWellQuerySchema>;

/**
 * Validation schema for Formation creation.
 */
export const CreateFormationSchema = z
  .object({
    name: z
      .string()
      .min(1, "Formation name is required")
      .max(100, "Formation name must not exceed 100 characters")
      .transform((val) => val.trim()),
    topMd: depthDecimalValidator("topMd"),
    bottomMd: depthDecimalValidator("bottomMd"),
    lithology: z
      .string()
      .max(100)
      .optional()
      .nullable()
      .transform((val) => (val ? val.trim() : null)),
  })
  .refine((data) => Number(data.bottomMd) >= Number(data.topMd), {
    message: "bottomMd must be greater than or equal to topMd",
    path: ["bottomMd"],
  });

export type CreateFormationInput = z.infer<typeof CreateFormationSchema>;

/**
 * Validation schema for Formation update.
 */
export const UpdateFormationSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .max(100)
      .transform((val) => val.trim())
      .optional(),
    topMd: depthDecimalValidator("topMd").optional(),
    bottomMd: depthDecimalValidator("bottomMd").optional(),
    lithology: z
      .string()
      .max(100)
      .optional()
      .nullable()
      .transform((val) => (val ? val.trim() : null)),
  })
  .refine(
    (data) => {
      if (data.topMd !== undefined && data.bottomMd !== undefined) {
        return Number(data.bottomMd) >= Number(data.topMd);
      }
      return true;
    },
    {
      message: "bottomMd must be greater than or equal to topMd",
      path: ["bottomMd"],
    },
  );

export type UpdateFormationInput = z.infer<typeof UpdateFormationSchema>;
