import { Router } from 'express';
import { ComplianceController } from '../controllers/compliance.controller';
import { authenticateMiddleware } from '../middleware/authenticate';
import { authorizeMiddleware } from '../middleware/authorize';
import { RoleCode } from '@prisma/client';

export const complianceRoutes = Router();

complianceRoutes.use(authenticateMiddleware);

// Run compliance rule evaluation (ADMIN, INSPECTOR)
complianceRoutes.post(
  '/:id/validate',
  authorizeMiddleware(RoleCode.ADMIN, RoleCode.INSPECTOR),
  ComplianceController.validateInspection
);

// Get validation results for inspection (ADMIN, INSPECTOR, REVIEWER)
complianceRoutes.get(
  '/:id/validation-results',
  authorizeMiddleware(RoleCode.ADMIN, RoleCode.INSPECTOR, RoleCode.REVIEWER),
  ComplianceController.getValidationResults
);

// Get violations for inspection (ADMIN, INSPECTOR, REVIEWER)
complianceRoutes.get(
  '/:id/violations',
  authorizeMiddleware(RoleCode.ADMIN, RoleCode.INSPECTOR, RoleCode.REVIEWER),
  ComplianceController.getViolations
);

// Get compliance summary for inspection (ADMIN, INSPECTOR, REVIEWER)
complianceRoutes.get(
  '/:id/compliance',
  authorizeMiddleware(RoleCode.ADMIN, RoleCode.INSPECTOR, RoleCode.REVIEWER),
  ComplianceController.getComplianceSummary
);
