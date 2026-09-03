import { Router } from 'express';
import { InspectionImageController } from '../controllers/inspectionImage.controller';
import { authenticateMiddleware } from '../middleware/authenticate';
import { authorizeMiddleware } from '../middleware/authorize';
import { uploadImageMiddleware } from '../middleware/upload.middleware';
import { RoleCode } from '@prisma/client';

const router = Router({ mergeParams: true });

router.post(
  '/:id/images',
  authenticateMiddleware,
  authorizeMiddleware(RoleCode.ADMIN, RoleCode.INSPECTOR),
  uploadImageMiddleware,
  InspectionImageController.upload
);

router.get('/:id/images', authenticateMiddleware, InspectionImageController.list);

router.get('/:id/images/:imageId', authenticateMiddleware, InspectionImageController.getById);

router.delete(
  '/:id/images/:imageId',
  authenticateMiddleware,
  authorizeMiddleware(RoleCode.ADMIN, RoleCode.INSPECTOR),
  InspectionImageController.delete
);

export const inspectionImageRoutes = router;
