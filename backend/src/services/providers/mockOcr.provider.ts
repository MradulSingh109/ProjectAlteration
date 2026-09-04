import { IOcrProvider, OcrInput, OcrOutput } from '../../types/ocr.types';
import { logger } from '../../config/logger';

/**
 * Mock OCR Provider Implementation
 * Used for local development, testing, and decoupling backend development
 * from the AI/ML team's OCR service.
 */
export class MockOcrProvider implements IOcrProvider {
  async processImage(input: OcrInput): Promise<OcrOutput> {
    logger.info(
      { inspectionId: input.inspectionId, imageId: input.inspectionImageId },
      '🤖 MockOcrProvider: Simulating OCR processing'
    );

    // Simulate micro processing delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      rawText:
        'MRP ₹499.00 (Incl. of all taxes)\nNet Quantity: 500 g\nMfg Date: 06/2026\nBatch No: BATCH-2026-X9\nCountry of Origin: India\nConsumer Care: support@brand.com / 1800-111-222',
      confidence: 0.95,
      language: 'eng',
      provider: 'mock',
      processingTimeMs: 150,
      boundingBoxes: [
        { text: 'MRP ₹499.00', confidence: 0.98, x: 10, y: 20, width: 100, height: 30 },
        { text: 'Net Quantity: 500 g', confidence: 0.94, x: 10, y: 60, width: 120, height: 30 },
        { text: 'Mfg Date: 06/2026', confidence: 0.96, x: 10, y: 100, width: 110, height: 30 },
      ],
      metadata: {
        mocked: true,
        environment: 'development',
      },
    };
  }
}
