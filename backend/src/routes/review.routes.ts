import { Router } from 'express';
import { ReviewController } from '../controllers/review.controller';
import { authenticateMiddleware } from '../middleware/authenticate';
import { authorizeMiddleware } from '../middleware/authorize';
import { RoleCode } from '@prisma/client';

export const reviewRoutes = Router();

reviewRoutes.use(authenticateMiddleware);

// List violations for inspection (ADMIN, INSPECTOR, REVIEWER)
reviewRoutes.get(
  '/:id/violations',
  authorizeMiddleware(RoleCode.ADMIN, RoleCode.INSPECTOR, RoleCode.REVIEWER),
  ReviewController.listViolations
);

// Get single violation by ID (ADMIN, INSPECTOR, REVIEWER)
reviewRoutes.get(
  '/:id/violations/:violationId',
  authorizeMiddleware(RoleCode.ADMIN, RoleCode.INSPECTOR, RoleCode.REVIEWER),
  ReviewController.getViolationById
);

// Update violation status (ADMIN, REVIEWER)
reviewRoutes.patch(
  '/:id/violations/:violationId/status',
  authorizeMiddleware(RoleCode.ADMIN, RoleCode.REVIEWER),
  ReviewController.updateViolationStatus
);

// List validation results for inspection (ADMIN, INSPECTOR, REVIEWER)
reviewRoutes.get(
  '/:id/validation-results',
  authorizeMiddleware(RoleCode.ADMIN, RoleCode.INSPECTOR, RoleCode.REVIEWER),
  ReviewController.listValidationResults
);

// Get single validation result by ID (ADMIN, INSPECTOR, REVIEWER)
reviewRoutes.get(
  '/:id/validation-results/:validationResultId',
  authorizeMiddleware(RoleCode.ADMIN, RoleCode.INSPECTOR, RoleCode.REVIEWER),
  ReviewController.getValidationResultById
);

// Submit human inspection review decision (ADMIN, REVIEWER)
reviewRoutes.post(
  '/:id/review',
  authorizeMiddleware(RoleCode.ADMIN, RoleCode.REVIEWER),
  ReviewController.completeInspectionReview
);
