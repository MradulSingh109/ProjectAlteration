/**
 * OCR Integration Layer Types & Interfaces
 * SIH26034 Legal Metrology Packaged Commodities Rule Compliance Checking System
 */

export interface OcrInput {
  inspectionId: string;
  inspectionImageId: string;
  storageKey: string;
  imageUrl: string;
  mimeType: string;
}

export interface OcrBoundingBox {
  text: string;
  confidence?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  page?: number;
}

export interface OcrOutput {
  rawText: string;
  confidence: number | null;
  language: string | null;
  provider: string;
  processingTimeMs?: number;
  boundingBoxes?: OcrBoundingBox[];
  metadata?: Record<string, unknown>;
}

export interface IOcrProvider {
  processImage(input: OcrInput): Promise<OcrOutput>;
}
