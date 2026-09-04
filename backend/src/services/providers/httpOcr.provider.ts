import { IOcrProvider, OcrInput, OcrOutput } from '../../types/ocr.types';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { AppError } from '../../utils/AppError';
import { ocrExternalResponseSchema } from '../../schemas/ocr.schema';

/**
 * HTTP OCR Provider Implementation
 * Communicates with the external AI/ML OCR microservice over HTTP.
 */
export class HttpOcrProvider implements IOcrProvider {
  private serviceUrl: string;
  private apiKey?: string;
  private timeoutMs: number;

  constructor() {
    if (!env.OCR_SERVICE_URL) {
      throw AppError.internal('HTTP OCR Provider configuration error: OCR_SERVICE_URL is missing');
    }
    this.serviceUrl = env.OCR_SERVICE_URL;
    this.apiKey = env.OCR_SERVICE_API_KEY;
    this.timeoutMs = env.OCR_TIMEOUT_MS;
  }

  async processImage(input: OcrInput): Promise<OcrOutput> {
    logger.info(
      {
        inspectionId: input.inspectionId,
        imageId: input.inspectionImageId,
        serviceUrl: this.serviceUrl,
      },
      '🌐 HttpOcrProvider: Sending OCR request to AI/ML service'
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      // Safe request payload - NEVER contains private Supabase credentials
      const requestPayload = {
        imageUrl: input.imageUrl,
        inspectionId: input.inspectionId,
        inspectionImageId: input.inspectionImageId,
        mimeType: input.mimeType,
      };

      const response = await fetch(this.serviceUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.error(
          { status: response.status, statusText: response.statusText },
          'HttpOcrProvider: External OCR HTTP service returned error status'
        );
        throw new AppError(
          `OCR provider service returned status code ${response.status}`,
          502,
          'OCR_PROVIDER_UNAVAILABLE'
        );
      }

      let responseJson: unknown;
      try {
        responseJson = await response.json();
      } catch (jsonErr) {
        logger.error({ err: jsonErr }, 'HttpOcrProvider: Failed to parse OCR response JSON');
        throw new AppError(
          'OCR provider service returned invalid JSON response',
          502,
          'OCR_PROVIDER_INVALID_RESPONSE'
        );
      }

      // Extract target data payload if wrapped in { success: true, data: { ... } } or raw object
      const dataPayload =
        typeof responseJson === 'object' &&
        responseJson !== null &&
        'data' in responseJson &&
        (responseJson as Record<string, unknown>).data
          ? (responseJson as Record<string, unknown>).data
          : responseJson;

      const parseResult = ocrExternalResponseSchema.safeParse(dataPayload);

      if (!parseResult.success) {
        logger.error(
          { issues: parseResult.error.issues, dataPayload },
          'HttpOcrProvider: External OCR response schema validation failed'
        );
        throw new AppError(
          'OCR provider response failed validation schema',
          502,
          'OCR_PROVIDER_INVALID_RESPONSE',
          parseResult.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
        );
      }

      const validated = parseResult.data;

      return {
        rawText: validated.rawText,
        confidence: validated.confidence,
        language: validated.language,
        provider: validated.provider || 'http-ai-ocr',
        processingTimeMs: validated.processingTimeMs,
        boundingBoxes: validated.boundingBoxes,
        metadata: validated.metadata,
      };
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error instanceof AppError) {
        throw error;
      }

      if (error.name === 'AbortError') {
        logger.error({ timeoutMs: this.timeoutMs }, 'HttpOcrProvider: OCR request timed out');
        throw new AppError(
          `OCR provider service request timed out after ${this.timeoutMs}ms`,
          504,
          'OCR_PROVIDER_TIMEOUT'
        );
      }

      logger.error({ err: error }, 'HttpOcrProvider: Network or execution failure during OCR call');
      throw new AppError(
        `OCR provider network failure: ${error.message || 'Service unreachable'}`,
        502,
        'OCR_PROVIDER_UNAVAILABLE'
      );
    }
  }
}
