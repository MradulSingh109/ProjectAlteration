import { z } from 'zod';

/**
 * Validates request URL path parameters for OCR endpoints
 */
export const ocrParamsSchema = z.object({
  inspectionId: z.string().uuid('Invalid inspection ID format'),
  imageId: z.string().uuid('Invalid image ID format'),
});

/**
 * Validates bounding box structures returned by external OCR providers
 */
export const ocrBoundingBoxSchema = z.object({
  text: z.string(),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .nullable()
    .optional()
    .transform((val) => (val === null ? undefined : val)),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  page: z.number().optional(),
});

/**
 * Validates normalized output payload returned by external AI/ML OCR HTTP endpoints
 */
export const ocrExternalResponseSchema = z.object({
  rawText: z.string({
    required_error: 'rawText is required in OCR response',
  }),
  confidence: z.number().min(0).max(1).nullable().default(null),
  language: z.string().nullable().default('en'),
  provider: z.string().min(1).default('external-http-ocr'),
  processingTimeMs: z.number().positive().optional(),
  boundingBoxes: z.array(ocrBoundingBoxSchema).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type OcrParamsInput = z.infer<typeof ocrParamsSchema>;
export type OcrExternalResponsePayload = z.infer<typeof ocrExternalResponseSchema>;
