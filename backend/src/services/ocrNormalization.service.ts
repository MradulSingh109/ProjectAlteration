import { OcrOutput, OcrBoundingBox } from '../types/ocr.types';
import { ocrResultValidationSchema, MAX_OCR_TEXT_LENGTH } from '../schemas/ocrResult.schema';
import { AppError } from '../utils/AppError';
import { logger } from '../config/logger';

export interface NormalizedOcrOutput {
  rawText: string;
  confidence: number | null;
  dbConfidence: number; // Non-nullable 0..1 Float required by PostgreSQL Prisma OCRResult model
  language: string;
  provider: string;
  boundingBoxes: OcrBoundingBox[];
  metadata?: Record<string, unknown>;
}

export class OcrNormalizationService {
  /**
   * Normalizes and validates OCR provider output prior to database persistence.
   * Standardizes confidence to [0, 1] range, verifies bounding box geometry,
   * preserves exact raw text provenance, and strips sensitive metadata.
   */
  static normalize(output: OcrOutput): NormalizedOcrOutput {
    if (!output || typeof output !== 'object') {
      throw AppError.ocrInvalidOutput('OCR output must be a non-null object');
    }

    if (typeof output.rawText !== 'string') {
      throw AppError.ocrInvalidText('OCR rawText must be a valid string');
    }

    if (output.rawText.length > MAX_OCR_TEXT_LENGTH) {
      throw AppError.ocrInvalidText(
        `OCR rawText length (${output.rawText.length}) exceeds maximum permitted boundary of ${MAX_OCR_TEXT_LENGTH} characters`
      );
    }

    // Check confidence bounds explicitly before schema parse for granular error reporting
    if (output.confidence !== null && output.confidence !== undefined) {
      if (typeof output.confidence !== 'number' || isNaN(output.confidence)) {
        throw AppError.ocrInvalidConfidence('OCR confidence must be a valid numeric value or null');
      }
      if (output.confidence < 0 || output.confidence > 100) {
        throw AppError.ocrInvalidConfidence(
          `OCR confidence value (${output.confidence}) is out of acceptable bounds (0..1 or 0..100)`
        );
      }
    }

    const parseResult = ocrResultValidationSchema.safeParse(output);

    if (!parseResult.success) {
      const issues = parseResult.error.issues;
      logger.error({ issues }, 'OcrNormalizationService: Output validation schema failed');

      const bbIssue = issues.find((i) => i.path.includes('boundingBoxes'));
      if (bbIssue) {
        throw AppError.ocrInvalidBoundingBoxes(
          `Invalid OCR bounding box geometry: ${bbIssue.message}`,
          issues
        );
      }

      const confIssue = issues.find((i) => i.path.includes('confidence'));
      if (confIssue) {
        throw AppError.ocrInvalidConfidence(`Invalid OCR confidence score: ${confIssue.message}`, issues);
      }

      const textIssue = issues.find((i) => i.path.includes('rawText'));
      if (textIssue) {
        throw AppError.ocrInvalidText(`Invalid OCR rawText payload: ${textIssue.message}`, issues);
      }

      throw AppError.ocrInvalidOutput('OCR output failed validation schema', issues);
    }

    const validated = parseResult.data;

    // Sanitize metadata to exclude authorization headers or credentials
    const sanitizedMetadata: Record<string, unknown> = {};
    if (validated.metadata && typeof validated.metadata === 'object') {
      const sensitiveKeys = ['authorization', 'auth', 'token', 'secret', 'key', 'password', 'bearer'];
      for (const [k, v] of Object.entries(validated.metadata)) {
        if (!sensitiveKeys.some((s) => k.toLowerCase().includes(s))) {
          sanitizedMetadata[k] = v;
        }
      }
    }

    // Determine normalized confidence and db float value
    const normalizedConfidence = validated.confidence;
    const dbConfidence = normalizedConfidence !== null ? normalizedConfidence : 0.0;

    return {
      rawText: validated.rawText,
      confidence: normalizedConfidence,
      dbConfidence,
      language: validated.language || 'en',
      provider: validated.provider || 'unknown',
      boundingBoxes: (validated.boundingBoxes as OcrBoundingBox[]) || [],
      metadata: Object.keys(sanitizedMetadata).length > 0 ? sanitizedMetadata : undefined,
    };
  }
}
