import { OCRProcessingStatus, WorkflowStatus, RoleCode } from '@prisma/client';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { AppError } from '../utils/AppError';
import { AuthUser } from '../types/express';
import { IOcrProvider } from '../types/ocr.types';
import { MockOcrProvider } from './providers/mockOcr.provider';
import { HttpOcrProvider } from './providers/httpOcr.provider';
import { OcrNormalizationService } from './ocrNormalization.service';
import { storageService } from './storage.service';
import { AuditService } from './audit.service';

export class OcrService {
  /**
   * Instantiates the configured OCR provider implementation based on environment configuration
   */
  private static getProvider(): IOcrProvider {
    if (env.OCR_PROVIDER === 'mock') {
      return new MockOcrProvider();
    }
    if (env.OCR_PROVIDER === 'http') {
      return new HttpOcrProvider();
    }
    throw AppError.internal(`Unsupported OCR_PROVIDER configured: ${env.OCR_PROVIDER}`);
  }

  /**
   * Triggers OCR processing for a target inspection image
   */
  static async triggerOcr(
    inspectionId: string,
    imageId: string,
    user: AuthUser,
    reqCtx?: { ip?: string; userAgent?: string }
  ) {
    // 1. Fetch & verify Inspection
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
    });

    if (!inspection) {
      throw AppError.notFound('Inspection not found', 'INSPECTION_NOT_FOUND');
    }

    // 2. Authorization & Ownership Checks
    if (user.role === RoleCode.REVIEWER) {
      throw AppError.forbidden('Reviewers are not permitted to trigger OCR processing', 'FORBIDDEN');
    }

    if (user.role === RoleCode.INSPECTOR && inspection.createdBy !== user.id) {
      throw AppError.forbidden(
        'Access denied. Inspectors may only trigger OCR for their own assigned inspections.',
        'FORBIDDEN'
      );
    }

    // 3. Workflow Eligibility Scoping
    if (
      inspection.workflowStatus !== WorkflowStatus.DRAFT &&
      inspection.workflowStatus !== WorkflowStatus.PROCESSING
    ) {
      throw AppError.badRequest(
        `Cannot trigger OCR for inspection in ${inspection.workflowStatus} state. Only DRAFT or PROCESSING inspections are eligible.`,
        'INSPECTION_NOT_ELIGIBLE'
      );
    }

    // 4. Fetch & verify InspectionImage & IDOR Mismatch Check
    const image = await prisma.inspectionImage.findUnique({
      where: { id: imageId },
    });

    if (!image) {
      throw AppError.notFound('Inspection image not found', 'IMAGE_NOT_FOUND');
    }

    if (image.inspectionId !== inspectionId) {
      throw AppError.notFound(
        'Specified image does not belong to this inspection',
        'IMAGE_INSPECTION_MISMATCH'
      );
    }

    // 5. Concurrency / Pending Request Lock Check
    const pendingResult = await prisma.oCRResult.findFirst({
      where: {
        inspectionImageId: imageId,
        processingStatus: OCRProcessingStatus.PENDING,
      },
    });

    if (pendingResult) {
      throw AppError.conflict(
        'OCR processing is already in progress for this image',
        'OCR_ALREADY_PROCESSING'
      );
    }

    // 6. Initialize PENDING OCRResult database record
    const ocrRecord = await prisma.oCRResult.create({
      data: {
        inspectionImageId: imageId,
        provider: env.OCR_PROVIDER,
        rawText: '',
        confidence: 0.0,
        language: 'en',
        processingStatus: OCRProcessingStatus.PENDING,
      },
    });

    await AuditService.logAction({
      userId: user.id,
      action: 'OCR_PROCESSING_STARTED',
      entityType: 'OCRResult',
      entityId: ocrRecord.id,
      newValue: {
        inspectionId,
        imageId,
        ocrResultId: ocrRecord.id,
        provider: env.OCR_PROVIDER,
        status: OCRProcessingStatus.PENDING,
      },
      ipAddress: reqCtx?.ip,
      userAgent: reqCtx?.userAgent,
    });

    // 7. Obtain image access URL from storage service
    const imageUrl = await storageService.getUrl(image.storageKey);

    // 8. Invoke Provider Execution & Normalization
    const provider = this.getProvider();

    try {
      const rawOcrOutput = await provider.processImage({
        inspectionId,
        inspectionImageId: imageId,
        storageKey: image.storageKey,
        imageUrl,
        mimeType: image.mimeType,
      });

      // Normalize & Validate OCR Output
      const normalized = OcrNormalizationService.normalize(rawOcrOutput);

      // 9. Update OCRResult on SUCCESS
      const updatedOcrRecord = await prisma.oCRResult.update({
        where: { id: ocrRecord.id },
        data: {
          processingStatus: OCRProcessingStatus.SUCCESS,
          rawText: normalized.rawText,
          confidence: normalized.dbConfidence,
          language: normalized.language,
          provider: normalized.provider,
          boundingBoxes: normalized.boundingBoxes ? (normalized.boundingBoxes as any) : undefined,
        },
      });

      await AuditService.logAction({
        userId: user.id,
        action: 'OCR_PROCESSING_COMPLETED',
        entityType: 'OCRResult',
        entityId: updatedOcrRecord.id,
        newValue: {
          inspectionId,
          imageId,
          ocrResultId: updatedOcrRecord.id,
          provider: updatedOcrRecord.provider,
          status: OCRProcessingStatus.SUCCESS,
          confidence: updatedOcrRecord.confidence,
        },
        ipAddress: reqCtx?.ip,
        userAgent: reqCtx?.userAgent,
      });

      return updatedOcrRecord;
    } catch (error: any) {
      // 10. Update OCRResult on FAILURE
      logger.error(
        { err: error, ocrResultId: ocrRecord.id, imageId },
        'OcrService: OCR processing provider failed'
      );

      await prisma.oCRResult.update({
        where: { id: ocrRecord.id },
        data: {
          processingStatus: OCRProcessingStatus.FAILED,
        },
      });

      await AuditService.logAction({
        userId: user.id,
        action: 'OCR_PROCESSING_FAILED',
        entityType: 'OCRResult',
        entityId: ocrRecord.id,
        newValue: {
          inspectionId,
          imageId,
          ocrResultId: ocrRecord.id,
          status: OCRProcessingStatus.FAILED,
          error: error.message || 'Processing failed',
        },
        ipAddress: reqCtx?.ip,
        userAgent: reqCtx?.userAgent,
      });

      throw error;
    }
  }

  /**
   * Retrieves all OCR results for a specific image (supporting provenance history)
   */
  static async getOcrResults(inspectionId: string, imageId: string, user: AuthUser) {
    // 1. Verify Inspection & Ownership
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
    });

    if (!inspection) {
      throw AppError.notFound('Inspection not found', 'INSPECTION_NOT_FOUND');
    }

    if (user.role === RoleCode.INSPECTOR && inspection.createdBy !== user.id) {
      throw AppError.forbidden(
        'Access denied. Inspectors may only view OCR results for their own assigned inspections.',
        'FORBIDDEN'
      );
    }

    // 2. Verify Image & IDOR check
    const image = await prisma.inspectionImage.findUnique({
      where: { id: imageId },
    });

    if (!image) {
      throw AppError.notFound('Inspection image not found', 'IMAGE_NOT_FOUND');
    }

    if (image.inspectionId !== inspectionId) {
      throw AppError.notFound(
        'Specified image does not belong to this inspection',
        'IMAGE_INSPECTION_MISMATCH'
      );
    }

    // 3. Fetch OCR results
    const results = await prisma.oCRResult.findMany({
      where: { inspectionImageId: imageId },
      orderBy: { createdAt: 'desc' },
    });

    return results;
  }

  /**
   * Returns current processing status for an image's OCR pipeline
   */
  static async getOcrStatus(inspectionId: string, imageId: string, user: AuthUser) {
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
    });

    if (!inspection) {
      throw AppError.notFound('Inspection not found', 'INSPECTION_NOT_FOUND');
    }

    if (user.role === RoleCode.INSPECTOR && inspection.createdBy !== user.id) {
      throw AppError.forbidden(
        'Access denied. Inspectors may only check OCR status for their own assigned inspections.',
        'FORBIDDEN'
      );
    }

    const image = await prisma.inspectionImage.findUnique({
      where: { id: imageId },
    });

    if (!image) {
      throw AppError.notFound('Inspection image not found', 'IMAGE_NOT_FOUND');
    }

    if (image.inspectionId !== inspectionId) {
      throw AppError.notFound(
        'Specified image does not belong to this inspection',
        'IMAGE_INSPECTION_MISMATCH'
      );
    }

    const latestResult = await prisma.oCRResult.findFirst({
      where: { inspectionImageId: imageId },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestResult) {
      return {
        status: 'NOT_STARTED',
        latestOcrResultId: null,
        provider: null,
        createdAt: null,
      };
    }

    return {
      status: latestResult.processingStatus,
      latestOcrResultId: latestResult.id,
      provider: latestResult.provider,
      createdAt: latestResult.createdAt,
    };
  }

  /**
   * Reprocesses OCR for an existing image (creates a new OCRResult entry)
   */
  static async reprocessOcr(
    inspectionId: string,
    imageId: string,
    user: AuthUser,
    reqCtx?: { ip?: string; userAgent?: string }
  ) {
    return this.triggerOcr(inspectionId, imageId, user, reqCtx);
  }
}
