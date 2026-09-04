import { Request, Response, NextFunction } from 'express';
import { ViolationReviewService } from '../services/review/violationReview.service';
import { InspectionReviewService } from '../services/review/inspectionReview.service';
import { updateViolationStatusSchema, reviewInspectionSchema } from '../services/review/types';
import { AuthUser } from '../types/express';
import { ViolationStatus, ViolationSeverity } from '@prisma/client';

export class ReviewController {
  /**
   * GET /api/inspections/:id/violations
   * List violations for an inspection with pagination and status/severity filtering
   */
  static async listViolations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const inspectionId = req.params.id as string;
      const user = req.user as AuthUser;

      const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const status = req.query.status ? (req.query.status as ViolationStatus) : undefined;
      const severity = req.query.severity ? (req.query.severity as ViolationSeverity) : undefined;
      const validationResultId = req.query.validationResultId
        ? (req.query.validationResultId as string)
        : undefined;

      const result = await ViolationReviewService.listViolations(
        inspectionId,
        { page, limit, status, severity, validationResultId },
        user
      );

      res.status(200).json({
        success: true,
        data: result.violations,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/inspections/:id/violations/:violationId
   * Get single violation details by ID
   */
  static async getViolationById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const inspectionId = req.params.id as string;
      const violationId = req.params.violationId as string;
      const user = req.user as AuthUser;

      const violation = await ViolationReviewService.getViolationById(
        inspectionId,
        violationId,
        user
      );

      res.status(200).json({
        success: true,
        data: violation,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/inspections/:id/violations/:violationId/status
   * Update status of a violation (ADMIN, REVIEWER)
   */
  static async updateViolationStatus(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const inspectionId = req.params.id as string;
      const violationId = req.params.violationId as string;
      const user = req.user as AuthUser;
      const userAgent = req.get('user-agent') || undefined;

      const validatedInput = updateViolationStatusSchema.parse(req.body);

      const updatedViolation = await ViolationReviewService.updateViolationStatus(
        inspectionId,
        violationId,
        validatedInput,
        user,
        { ip: req.ip, userAgent }
      );

      res.status(200).json({
        success: true,
        data: updatedViolation,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/inspections/:id/validation-results
   * List validation results for an inspection
   */
  static async listValidationResults(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const inspectionId = req.params.id as string;
      const user = req.user as AuthUser;

      const results = await InspectionReviewService.listValidationResults(inspectionId, user);

      res.status(200).json({
        success: true,
        data: results,
        meta: {
          count: results.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/inspections/:id/validation-results/:validationResultId
   * Get single validation result by ID
   */
  static async getValidationResultById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const inspectionId = req.params.id as string;
      const validationResultId = req.params.validationResultId as string;
      const user = req.user as AuthUser;

      const result = await InspectionReviewService.getValidationResultById(
        inspectionId,
        validationResultId,
        user
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/inspections/:id/review
   * Submit human review decision for an inspection (ADMIN, REVIEWER)
   */
  static async completeInspectionReview(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const inspectionId = req.params.id as string;
      const user = req.user as AuthUser;
      const userAgent = req.get('user-agent') || undefined;

      const validatedInput = reviewInspectionSchema.parse(req.body);

      const result = await InspectionReviewService.completeInspectionReview(
        inspectionId,
        validatedInput,
        user,
        { ip: req.ip, userAgent }
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
