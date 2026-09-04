import { z } from 'zod';

export const MAX_OCR_TEXT_LENGTH = 50000;

/**
 * Validates individual OCR bounding box coordinates and properties
 */
export const ocrBoundingBoxValidationSchema = z.object({
  text: z.string({
    required_error: 'Bounding box text must be a string',
  }),
  confidence: z
    .number()
    .nullable()
    .optional()
    .transform((val) => {
      if (val === null || val === undefined || isNaN(val)) return undefined;
      let conf = val;
      if (conf > 1 && conf <= 100) {
        conf = conf / 100;
      }
      if (conf < 0 || conf > 1) {
        return undefined;
      }
      return parseFloat(conf.toFixed(4));
    }),
  x: z.number({ required_error: 'x coordinate must be numeric' }).min(0, 'x coordinate must be >= 0'),
  y: z.number({ required_error: 'y coordinate must be numeric' }).min(0, 'y coordinate must be >= 0'),
  width: z
    .number({ required_error: 'width must be numeric' })
    .min(0, 'width coordinate must be >= 0'),
  height: z
    .number({ required_error: 'height must be numeric' })
    .min(0, 'height coordinate must be >= 0'),
  page: z.number().int().min(1).optional(),
});

/**
 * Validates full raw OCR output object prior to normalization & persistence
 */
export const ocrResultValidationSchema = z.object({
  rawText: z
    .string({
      required_error: 'OCR rawText is required and must be a string',
    })
    .max(MAX_OCR_TEXT_LENGTH, `OCR rawText exceeds maximum allowed length of ${MAX_OCR_TEXT_LENGTH} characters`),
  confidence: z
    .number()
    .nullable()
    .optional()
    .transform((val) => {
      if (val === null || val === undefined || isNaN(val)) return null;
      let conf = val;
      if (conf > 1 && conf <= 100) {
        conf = conf / 100;
      }
      if (conf < 0 || conf > 1) {
        return null;
      }
      return parseFloat(conf.toFixed(4));
    }),
  language: z.string().nullable().default('en'),
  provider: z.string({ required_error: 'provider is required' }).min(1, 'provider name cannot be empty'),
  processingTimeMs: z.number().positive().optional(),
  boundingBoxes: z.array(ocrBoundingBoxValidationSchema).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type ValidatedOcrResult = z.infer<typeof ocrResultValidationSchema>;
