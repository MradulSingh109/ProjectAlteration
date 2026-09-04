import { Request, Response, NextFunction } from 'express';
import { DeclarationExtractionService } from '../services/declarationExtraction.service';
import { AuthUser } from '../types/express';

export class DeclarationController {
  /**
   * POST /api/inspections/:id/images/:imageId/ocr/:ocrResultId/extract
   * Triggers OCR declaration attribute extraction
   */
  static async extractDeclarations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const inspectionId = req.params.id as string;
      const imageId = req.params.imageId as string;
      const ocrResultId = req.params.ocrResultId as string;
      const user = req.user as AuthUser;
      const userAgent = req.get('user-agent') || undefined;

      const declarations = await DeclarationExtractionService.extractFromOcrResult(
        inspectionId,
        imageId,
        ocrResultId,
        user,
        {
          ip: req.ip,
          userAgent,
        }
      );

      res.status(201).json({
        success: true,
        data: declarations,
        meta: {
          extractedCount: declarations.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/inspections/:id/images/:imageId/ocr/:ocrResultId/reextract
   * Re-triggers OCR declaration attribute extraction idempotently
   */
  static async reextractDeclarations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const inspectionId = req.params.id as string;
      const imageId = req.params.imageId as string;
      const ocrResultId = req.params.ocrResultId as string;
      const user = req.user as AuthUser;
      const userAgent = req.get('user-agent') || undefined;

      const declarations = await DeclarationExtractionService.reextractDeclarations(
        inspectionId,
        imageId,
        ocrResultId,
        user,
        {
          ip: req.ip,
          userAgent,
        }
      );

      res.status(200).json({
        success: true,
        data: declarations,
        meta: {
          extractedCount: declarations.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/inspections/:id/declarations
   * Retrieves all extracted declarations for an inspection
   */
  static async getDeclarationsByInspection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const inspectionId = req.params.id as string;
      const user = req.user as AuthUser;

      const declarations = await DeclarationExtractionService.getDeclarationsByInspection(
        inspectionId,
        user
      );

      res.status(200).json({
        success: true,
        data: declarations,
        meta: {
          count: declarations.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/inspections/:id/declarations/:declarationId
   * Retrieves a single extracted declaration by ID
   */
  static async getDeclarationById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const inspectionId = req.params.id as string;
      const declarationId = req.params.declarationId as string;
      const user = req.user as AuthUser;

      const declaration = await DeclarationExtractionService.getDeclarationById(
        inspectionId,
        declarationId,
        user
      );

      res.status(200).json({
        success: true,
        data: declaration,
      });
    } catch (error) {
      next(error);
    }
  }
}
