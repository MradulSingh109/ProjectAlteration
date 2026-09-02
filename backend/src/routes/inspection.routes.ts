import { Router } from 'express';
import { InspectionController } from '../controllers/inspection.controller';
import { authenticateMiddleware } from '../middleware/authenticate';
import { authorizeMiddleware } from '../middleware/authorize';
import { RoleCode } from '@prisma/client';

const router = Router();

router.post(
  '/',
  authenticateMiddleware,
  authorizeMiddleware(RoleCode.ADMIN, RoleCode.INSPECTOR),
  InspectionController.create
);

router.get('/', authenticateMiddleware, InspectionController.list);

router.get('/:id', authenticateMiddleware, InspectionController.getById);

router.patch(
  '/:id',
  authenticateMiddleware,
  authorizeMiddleware(RoleCode.ADMIN, RoleCode.INSPECTOR),
  InspectionController.update
);

router.patch(
  '/:id/status',
  authenticateMiddleware,
  authorizeMiddleware(RoleCode.ADMIN, RoleCode.INSPECTOR),
  InspectionController.updateStatus
);

export const inspectionRoutes = router;
