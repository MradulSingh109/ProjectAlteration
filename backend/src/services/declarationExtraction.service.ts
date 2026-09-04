import { WorkflowStatus, RoleCode, OCRProcessingStatus, DeclarationSource } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { AuthUser } from '../types/express';
import { DeclarationParser } from '../utils/declarationParser';
import { AuditService } from './audit.service';

export class DeclarationExtractionService {
  /**
   * Triggers OCR declaration attribute extraction for a specific OCRResult record.
   * Parses raw OCR text into structured declarations (MRP, Net Qty, Dates, Mfg Address, etc.)
   * and idempotently persists them with complete evidence provenance.
   */
  static async extractFromOcrResult(
    inspectionId: string,
    imageId: string,
    ocrResultId: string,
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

    // 2. RBAC Authorization Checks
    if (user.role === RoleCode.REVIEWER) {
      throw AppError.forbidden('Reviewers are not permitted to trigger declaration extraction', 'FORBIDDEN');
    }

    if (user.role === RoleCode.INSPECTOR && inspection.createdBy !== user.id) {
      throw AppError.forbidden(
        'Access denied. Inspectors may only trigger declaration extraction for their own inspections.',
        'FORBIDDEN'
      );
    }

    // 3. Workflow State Restrictions
    if (
      inspection.workflowStatus === WorkflowStatus.COMPLETED ||
      inspection.workflowStatus === WorkflowStatus.CANCELLED
    ) {
      throw AppError.inspectionNotEditable(
        `Cannot extract declarations for an inspection in ${inspection.workflowStatus} status.`
      );
    }

    // 4. Fetch & verify InspectionImage (IDOR check)
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

    // 5. Fetch & verify OCRResult (IDOR & Status check)
    const ocrResult = await prisma.oCRResult.findUnique({
      where: { id: ocrResultId },
    });

    if (!ocrResult) {
      throw AppError.notFound('OCR result not found', 'OCR_RESULT_NOT_FOUND');
    }

    if (ocrResult.inspectionImageId !== imageId) {
      throw AppError.notFound(
        'Specified OCR result does not belong to this image',
        'OCR_RESULT_IMAGE_MISMATCH'
      );
    }

    if (ocrResult.processingStatus !== OCRProcessingStatus.SUCCESS) {
      throw AppError.ocrResultNotSuccessful(
        `Cannot extract declarations from OCR result with status '${ocrResult.processingStatus}'. Status must be SUCCESS.`
      );
    }

    // 6. Execute Deterministic Extraction Parser
    const parsedItems = DeclarationParser.extractDeclarations(ocrResult.rawText);

    // 7. Execute Transaction for Idempotent Persistence & Provenance
    const createdDeclarations = await prisma.$transaction(async (tx) => {
      // Clean up previous automated OCR declarations derived from this source image for idempotency
      await tx.declaration.deleteMany({
        where: {
          inspectionId,
          sourceImageId: imageId,
          source: DeclarationSource.OCR,
          isHumanReviewed: false,
        },
      });

      // Insert new extracted declarations
      const declarations = [];
      for (const item of parsedItems) {
        const decl = await tx.declaration.create({
          data: {
            inspectionId,
            sourceImageId: imageId,
            type: item.type,
            source: DeclarationSource.OCR,
            rawValue: item.rawValue,
            normalizedValue: item.normalizedValue,
            confidence: item.confidence,
          },
        });
        declarations.push(decl);
      }

      return declarations;
    });

    // 8. Log Audit Trail
    await AuditService.logAction({
      userId: user.id,
      action: 'DECLARATION_EXTRACTION_COMPLETED',
      entityType: 'Declaration',
      entityId: ocrResultId,
      newValue: {
        inspectionId,
        imageId,
        ocrResultId,
        extractedCount: createdDeclarations.length,
        types: createdDeclarations.map((d) => d.type),
      },
      ipAddress: reqCtx?.ip,
      userAgent: reqCtx?.userAgent,
    });

    return createdDeclarations;
  }

  /**
   * Retrieves all extracted declarations for an inspection.
   */
  static async getDeclarationsByInspection(inspectionId: string, user: AuthUser) {
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
    });

    if (!inspection) {
      throw AppError.notFound('Inspection not found', 'INSPECTION_NOT_FOUND');
    }

    if (user.role === RoleCode.INSPECTOR && inspection.createdBy !== user.id) {
      throw AppError.forbidden(
        'Access denied. Inspectors may only view declarations for their own inspections.',
        'FORBIDDEN'
      );
    }

    const declarations = await prisma.declaration.findMany({
      where: { inspectionId },
      orderBy: { createdAt: 'desc' },
    });

    return declarations;
  }

  /**
   * Retrieves a single declaration by ID with IDOR validation.
   */
  static async getDeclarationById(inspectionId: string, declarationId: string, user: AuthUser) {
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
    });

    if (!inspection) {
      throw AppError.notFound('Inspection not found', 'INSPECTION_NOT_FOUND');
    }

    if (user.role === RoleCode.INSPECTOR && inspection.createdBy !== user.id) {
      throw AppError.forbidden(
        'Access denied. Inspectors may only view declarations for their own inspections.',
        'FORBIDDEN'
      );
    }

    const declaration = await prisma.declaration.findUnique({
      where: { id: declarationId },
    });

    if (!declaration) {
      throw AppError.declarationNotFound();
    }

    if (declaration.inspectionId !== inspectionId) {
      throw AppError.declarationInspectionMismatch();
    }

    return declaration;
  }

  /**
   * Re-extracts declarations idempotently for a target OCR result.
   */
  static async reextractDeclarations(
    inspectionId: string,
    imageId: string,
    ocrResultId: string,
    user: AuthUser,
    reqCtx?: { ip?: string; userAgent?: string }
  ) {
    return this.extractFromOcrResult(inspectionId, imageId, ocrResultId, user, reqCtx);
  }
}
