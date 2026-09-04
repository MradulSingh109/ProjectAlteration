import { Request, Response, NextFunction } from 'express';
import { RuleEngineService } from '../services/compliance/ruleEngine.service';
import { ReviewController } from './review.controller';
import { AuthUser } from '../types/express';

export class ComplianceController {
  /**
   * POST /api/inspections/:id/validate
   * Triggers compliance rule evaluation for an inspection
   */
  static async validateInspection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const inspectionId = req.params.id as string;
      const user = req.user as AuthUser;
      const userAgent = req.get('user-agent') || undefined;

      const summary = await RuleEngineService.validateInspection(inspectionId, user, {
        ip: req.ip,
        userAgent,
      });

      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/inspections/:id/validation-results
   * Retrieves all validation results for an inspection
   */
  static async getValidationResults(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const inspectionId = req.params.id as string;
      const user = req.user as AuthUser;

      const results = await RuleEngineService.getValidationResultsByInspection(
        inspectionId,
        user
      );

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
   * GET /api/inspections/:id/violations
   * Retrieves violations for an inspection with pagination and status/severity filtering
   */
  static async getViolations(req: Request, res: Response, next: NextFunction): Promise<void> {
    return ReviewController.listViolations(req, res, next);
  }

  /**
   * GET /api/inspections/:id/compliance
   * Retrieves overall compliance summary for an inspection
   */
  static async getComplianceSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const inspectionId = req.params.id as string;
      const user = req.user as AuthUser;

      const summary = await RuleEngineService.getComplianceSummary(inspectionId, user);

      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }
}
