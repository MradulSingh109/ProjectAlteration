import { Router } from 'express';
import { RoleCode } from '@prisma/client';
import { authenticateMiddleware } from '../middleware/authenticate';
import { authorizeMiddleware } from '../middleware/authorize';
import { ReportController } from '../controllers/report.controller';

const inspectionReportRoutes = Router();
const dashboardReportRoutes = Router();

// ==========================================
// Inspection Report Routes (/api/inspections)
// ==========================================

// GET /api/inspections/:id/compliance-summary
inspectionReportRoutes.get(
  '/:id/compliance-summary',
  authenticateMiddleware,
  authorizeMiddleware(RoleCode.ADMIN, RoleCode.INSPECTOR, RoleCode.REVIEWER),
  ReportController.getComplianceSummary
);

// GET /api/inspections/:id/compliance-result
inspectionReportRoutes.get(
  '/:id/compliance-result',
  authenticateMiddleware,
  authorizeMiddleware(RoleCode.ADMIN, RoleCode.INSPECTOR, RoleCode.REVIEWER),
  ReportController.getComplianceResult
);

// GET /api/inspections/:id/report
inspectionReportRoutes.get(
  '/:id/report',
  authenticateMiddleware,
  authorizeMiddleware(RoleCode.ADMIN, RoleCode.INSPECTOR, RoleCode.REVIEWER),
  ReportController.getReport
);

// POST /api/inspections/:id/reports
inspectionReportRoutes.post(
  '/:id/reports',
  authenticateMiddleware,
  authorizeMiddleware(RoleCode.ADMIN, RoleCode.INSPECTOR, RoleCode.REVIEWER),
  ReportController.createReport
);

// GET /api/inspections/:id/reports
inspectionReportRoutes.get(
  '/:id/reports',
  authenticateMiddleware,
  authorizeMiddleware(RoleCode.ADMIN, RoleCode.INSPECTOR, RoleCode.REVIEWER),
  ReportController.listReports
);

// GET /api/inspections/:id/reports/:reportId
inspectionReportRoutes.get(
  '/:id/reports/:reportId',
  authenticateMiddleware,
  authorizeMiddleware(RoleCode.ADMIN, RoleCode.INSPECTOR, RoleCode.REVIEWER),
  ReportController.getReportById
);

// ==========================================
// Dashboard Report Routes (/api/reports)
// ==========================================

// GET /api/reports/summary
dashboardReportRoutes.get(
  '/summary',
  authenticateMiddleware,
  authorizeMiddleware(RoleCode.ADMIN, RoleCode.INSPECTOR, RoleCode.REVIEWER),
  ReportController.getDashboardSummary
);

export { inspectionReportRoutes, dashboardReportRoutes };
