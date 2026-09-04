import { Request, Response, NextFunction } from 'express';
import { ReportService } from '../services/report/report.service';
import { createReportSchema } from '../services/report/types';
import { AuthUser } from '../types/express';

export class ReportController {
  /**
   * GET /api/inspections/:id/compliance-summary
   */
  static async getComplianceSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const inspectionId = req.params.id as string;
      const user = req.user as AuthUser;

      const summary = await ReportService.getComplianceSummary(inspectionId, user);

      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/inspections/:id/compliance-result
   */
  static async getComplianceResult(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const inspectionId = req.params.id as string;
      const user = req.user as AuthUser;

      const result = await ReportService.getComplianceResult(inspectionId, user);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/inspections/:id/report
   */
  static async getReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const inspectionId = req.params.id as string;
      const user = req.user as AuthUser;
      const persist = req.query.persist === 'true';

      if (persist) {
        const result = await ReportService.createAndPersistReport(inspectionId, user);
        res.status(201).json({
          success: true,
          data: result,
        });
        return;
      }

      const reportData = await ReportService.generateReportData(inspectionId, user);

      res.status(200).json({
        success: true,
        data: reportData,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/inspections/:id/reports
   */
  static async createReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const inspectionId = req.params.id as string;
      const user = req.user as AuthUser;

      const input = createReportSchema.parse(req.body);
      const result = await ReportService.createAndPersistReport(inspectionId, user, input);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/inspections/:id/reports
   */
  static async listReports(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const inspectionId = req.params.id as string;
      const user = req.user as AuthUser;

      const reports = await ReportService.listInspectionReports(inspectionId, user);

      res.status(200).json({
        success: true,
        data: reports,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/inspections/:id/reports/:reportId
   */
  static async getReportById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const inspectionId = req.params.id as string;
      const reportId = req.params.reportId as string;
      const user = req.user as AuthUser;

      const result = await ReportService.getReportById(inspectionId, reportId, user);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/reports/summary (Compliance Dashboard Summary)
   */
  static async getDashboardSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as AuthUser;

      const summary = await ReportService.getDashboardSummary(user);

      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }
}
