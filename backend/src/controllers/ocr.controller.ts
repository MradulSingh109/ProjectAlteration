import { Request, Response, NextFunction } from 'express';
import { ocrParamsSchema } from '../schemas/ocr.schema';
import { OcrService } from '../services/ocr.service';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/AppError';

export class OcrController {
  /**
   * POST /api/inspections/:id/images/:imageId/ocr
   * Triggers OCR processing on an inspection image
   */
  static async trigger(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED');
      }

      const { inspectionId, imageId } = ocrParamsSchema.parse({
        inspectionId: req.params.id,
        imageId: req.params.imageId,
      });

      const userAgentHeader = req.get('user-agent');
      const reqCtx = {
        ip: req.ip || req.socket.remoteAddress,
        userAgent: Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader,
      };

      const ocrResult = await OcrService.triggerOcr(inspectionId, imageId, req.user, reqCtx);

      sendSuccess(res, ocrResult, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/inspections/:id/images/:imageId/ocr
   * Retrieves all OCR results for an inspection image
   */
  static async getResults(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED');
      }

      const { inspectionId, imageId } = ocrParamsSchema.parse({
        inspectionId: req.params.id,
        imageId: req.params.imageId,
      });

      const ocrResults = await OcrService.getOcrResults(inspectionId, imageId, req.user);

      sendSuccess(res, ocrResults, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/inspections/:id/images/:imageId/ocr/status
   * Retrieves current pipeline status for an inspection image
   */
  static async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED');
      }

      const { inspectionId, imageId } = ocrParamsSchema.parse({
        inspectionId: req.params.id,
        imageId: req.params.imageId,
      });

      const status = await OcrService.getOcrStatus(inspectionId, imageId, req.user);

      sendSuccess(res, status, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/inspections/:id/images/:imageId/ocr/reprocess
   * Reprocesses OCR for an inspection image
   */
  static async reprocess(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED');
      }

      const { inspectionId, imageId } = ocrParamsSchema.parse({
        inspectionId: req.params.id,
        imageId: req.params.imageId,
      });

      const userAgentHeader = req.get('user-agent');
      const reqCtx = {
        ip: req.ip || req.socket.remoteAddress,
        userAgent: Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader,
      };

      const ocrResult = await OcrService.reprocessOcr(inspectionId, imageId, req.user, reqCtx);

      sendSuccess(res, ocrResult, 201);
    } catch (error) {
      next(error);
    }
  }
}
