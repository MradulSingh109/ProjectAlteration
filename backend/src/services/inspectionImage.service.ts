import crypto from 'crypto';
import { ImageType, RoleCode, WorkflowStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { storageService } from './storage.service';
import { AuditService } from './audit.service';
import { validateImageMagicBytes } from '../utils/fileValidation';
import { AuthUser } from '../types/express';
import { AppError } from '../utils/AppError';
import { logger } from '../config/logger';

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export class InspectionImageService {
  static async uploadImage(
    inspectionId: string,
    file: Express.Multer.File | undefined,
    imageType: ImageType,
    user: AuthUser,
    reqCtx?: { ip?: string; userAgent?: string }
  ) {
    // 1. Check file exists
    if (!file || !file.buffer) {
      throw AppError.badRequest('No image file provided in request', 'INVALID_FILE');
    }

    // 2. Find target inspection
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
    });

    if (!inspection) {
      throw AppError.notFound('Inspection not found', 'INSPECTION_NOT_FOUND');
    }

    // 3. Ownership & Authorization check
    if (user.role === RoleCode.REVIEWER) {
      throw AppError.forbidden('Reviewers are not permitted to upload images', 'FORBIDDEN');
    }

    if (user.role === RoleCode.INSPECTOR && inspection.createdBy !== user.id) {
      throw AppError.forbidden(
        'Access denied. Inspectors may only upload images to their own assigned inspections.',
        'FORBIDDEN'
      );
    }

    // 4. Workflow State restriction (reject COMPLETED / CANCELLED)
    if (
      inspection.workflowStatus === WorkflowStatus.COMPLETED ||
      inspection.workflowStatus === WorkflowStatus.CANCELLED
    ) {
      throw AppError.badRequest(
        `Cannot upload images to an inspection in '${inspection.workflowStatus}' state.`,
        'INSPECTION_NOT_EDITABLE'
      );
    }

    // 5. Verify real image binary magic bytes signature
    const detectedMime = validateImageMagicBytes(file.buffer);
    if (!detectedMime) {
      throw AppError.badRequest(
        'File binary content does not match a valid JPEG, PNG, or WebP image signature',
        'UNSUPPORTED_FILE_TYPE'
      );
    }

    // 6. Generate server-side safe unique storage key
    const ext = MIME_EXTENSION_MAP[detectedMime] || 'jpg';
    const storageKey = `inspections/${inspectionId}/${crypto.randomUUID()}.${ext}`;

    // 7. Upload to Storage Service
    let uploadResult;
    try {
      uploadResult = await storageService.upload(file.buffer, storageKey, detectedMime);
    } catch (err: any) {
      logger.error({ err, storageKey }, 'Storage upload operation failed');
      throw AppError.internal('Failed to upload image file to storage service', 'STORAGE_ERROR');
    }

    // 8. Create DB record & Audit Log inside transaction with orphan cleanup fallback
    try {
      return await prisma.$transaction(async (tx) => {
        const imageRecord = await tx.inspectionImage.create({
          data: {
            inspectionId,
            fileUrl: uploadResult.url,
            storageKey: uploadResult.key,
            originalFileName: file.originalname || 'uploaded_image',
            mimeType: detectedMime,
            fileSize: file.size,
            imageType: imageType || ImageType.OTHER,
          },
          select: {
            id: true,
            inspectionId: true,
            fileUrl: true,
            storageKey: true,
            originalFileName: true,
            mimeType: true,
            fileSize: true,
            imageType: true,
            uploadedAt: true,
          },
        });

        await AuditService.logAction(
          {
            userId: user.id,
            action: 'INSPECTION_IMAGE_UPLOADED',
            entityType: 'InspectionImage',
            entityId: imageRecord.id,
            newValue: imageRecord as unknown as Record<string, unknown>,
            ipAddress: reqCtx?.ip,
            userAgent: reqCtx?.userAgent,
          },
          tx
        );

        return imageRecord;
      });
    } catch (dbError) {
      // Cleanup uploaded object if DB write fails
      logger.error({ dbError, storageKey }, 'Database creation failed after storage upload, rolling back storage object');
      try {
        await storageService.delete(uploadResult.key);
      } catch (cleanupErr) {
        logger.error({ cleanupErr, storageKey }, 'Failed to cleanup orphan storage object');
      }
      throw dbError;
    }
  }

  static async listImages(inspectionId: string, user: AuthUser) {
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
    });

    if (!inspection) {
      throw AppError.notFound('Inspection not found', 'INSPECTION_NOT_FOUND');
    }

    // Authorization & Ownership check
    if (user.role === RoleCode.INSPECTOR && inspection.createdBy !== user.id) {
      throw AppError.forbidden(
        'Access denied. Inspectors may only view images of their own assigned inspections.',
        'FORBIDDEN'
      );
    }

    return prisma.inspectionImage.findMany({
      where: { inspectionId },
      select: {
        id: true,
        inspectionId: true,
        fileUrl: true,
        storageKey: true,
        originalFileName: true,
        mimeType: true,
        fileSize: true,
        imageType: true,
        uploadedAt: true,
      },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  static async getImageById(inspectionId: string, imageId: string, user: AuthUser) {
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
    });

    if (!inspection) {
      throw AppError.notFound('Inspection not found', 'INSPECTION_NOT_FOUND');
    }

    if (user.role === RoleCode.INSPECTOR && inspection.createdBy !== user.id) {
      throw AppError.forbidden(
        'Access denied. Inspectors may only view images of their own assigned inspections.',
        'FORBIDDEN'
      );
    }

    const image = await prisma.inspectionImage.findUnique({
      where: { id: imageId },
      select: {
        id: true,
        inspectionId: true,
        fileUrl: true,
        storageKey: true,
        originalFileName: true,
        mimeType: true,
        fileSize: true,
        imageType: true,
        uploadedAt: true,
      },
    });

    if (!image) {
      throw AppError.notFound('Inspection image not found', 'IMAGE_NOT_FOUND');
    }

    // IDOR / Cross-inspection access verification
    if (image.inspectionId !== inspectionId) {
      throw AppError.notFound(
        'Specified image does not belong to this inspection',
        'IMAGE_NOT_FOUND'
      );
    }

    return image;
  }

  static async deleteImage(
    inspectionId: string,
    imageId: string,
    user: AuthUser,
    reqCtx?: { ip?: string; userAgent?: string }
  ) {
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
    });

    if (!inspection) {
      throw AppError.notFound('Inspection not found', 'INSPECTION_NOT_FOUND');
    }

    // Authorization checks
    if (user.role === RoleCode.REVIEWER) {
      throw AppError.forbidden('Reviewers are not permitted to delete images', 'FORBIDDEN');
    }

    if (user.role === RoleCode.INSPECTOR && inspection.createdBy !== user.id) {
      throw AppError.forbidden(
        'Access denied. Inspectors may only delete images from their own assigned inspections.',
        'FORBIDDEN'
      );
    }

    // Workflow status check
    if (
      inspection.workflowStatus === WorkflowStatus.COMPLETED ||
      inspection.workflowStatus === WorkflowStatus.CANCELLED
    ) {
      throw AppError.badRequest(
        `Cannot delete images from an inspection in '${inspection.workflowStatus}' state.`,
        'INSPECTION_NOT_EDITABLE'
      );
    }

    const image = await prisma.inspectionImage.findUnique({
      where: { id: imageId },
    });

    if (!image) {
      throw AppError.notFound('Inspection image not found', 'IMAGE_NOT_FOUND');
    }

    // IDOR protection
    if (image.inspectionId !== inspectionId) {
      throw AppError.notFound(
        'Specified image does not belong to this inspection',
        'IMAGE_NOT_FOUND'
      );
    }

    // Delete DB record & audit log first, then delete storage object
    await prisma.$transaction(async (tx) => {
      await tx.inspectionImage.delete({
        where: { id: imageId },
      });

      await AuditService.logAction(
        {
          userId: user.id,
          action: 'INSPECTION_IMAGE_DELETED',
          entityType: 'InspectionImage',
          entityId: imageId,
          oldValue: image as unknown as Record<string, unknown>,
          ipAddress: reqCtx?.ip,
          userAgent: reqCtx?.userAgent,
        },
        tx
      );
    });

    // Remove from storage
    try {
      await storageService.delete(image.storageKey);
    } catch (err) {
      logger.warn({ err, storageKey: image.storageKey }, 'Storage deletion failed after DB record removal');
    }

    return { id: imageId, deleted: true };
  }
}
