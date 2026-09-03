import { Request, Response, NextFunction } from 'express';
import { ImageType } from '@prisma/client';
import { InspectionImageService } from '../services/inspectionImage.service';
import { uploadImageBodySchema } from '../schemas/inspectionImage.schema';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/AppError';

export class InspectionImageController {
  static async upload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED');
      }

      const inspectionId = req.params.id as string;
      if (!inspectionId) {
        throw AppError.badRequest('Inspection ID parameter is required', 'VALIDATION_ERROR');
      }

      const parseResult = uploadImageBodySchema.safeParse(req.body);
      const imageType = parseResult.success ? parseResult.data.imageType : ImageType.OTHER;

      const userAgentHeader = req.get('user-agent');
      const reqCtx = {
        ip: req.ip,
        userAgent: Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader,
      };

      const image = await InspectionImageService.uploadImage(
        inspectionId,
        req.file,
        imageType,
        req.user,
        reqCtx
      );

      sendSuccess(res, { image }, 201);
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED');
      }

      const inspectionId = req.params.id as string;
      if (!inspectionId) {
        throw AppError.badRequest('Inspection ID parameter is required', 'VALIDATION_ERROR');
      }

      const images = await InspectionImageService.listImages(inspectionId, req.user);
      sendSuccess(res, { images }, 200);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED');
      }

      const inspectionId = req.params.id as string;
      const imageId = req.params.imageId as string;

      if (!inspectionId || !imageId) {
        throw AppError.badRequest(
          'Both inspection ID and image ID parameters are required',
          'VALIDATION_ERROR'
        );
      }

      const image = await InspectionImageService.getImageById(inspectionId, imageId, req.user);
      sendSuccess(res, { image }, 200);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED');
      }

      const inspectionId = req.params.id as string;
      const imageId = req.params.imageId as string;

      if (!inspectionId || !imageId) {
        throw AppError.badRequest(
          'Both inspection ID and image ID parameters are required',
          'VALIDATION_ERROR'
        );
      }

      const userAgentHeader = req.get('user-agent');
      const reqCtx = {
        ip: req.ip,
        userAgent: Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader,
      };

      const result = await InspectionImageService.deleteImage(
        inspectionId,
        imageId,
        req.user,
        reqCtx
      );

      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }
}
