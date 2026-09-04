import { Router } from 'express';
import { OcrController } from '../controllers/ocr.controller';
import { authenticateMiddleware } from '../middleware/authenticate';
import { authorizeMiddleware } from '../middleware/authorize';
import { RoleCode } from '@prisma/client';

const router = Router({ mergeParams: true });

router.post(
  '/:id/images/:imageId/ocr',
  authenticateMiddleware,
  authorizeMiddleware(RoleCode.ADMIN, RoleCode.INSPECTOR),
  OcrController.trigger
);

router.get('/:id/images/:imageId/ocr', authenticateMiddleware, OcrController.getResults);

router.get('/:id/images/:imageId/ocr/status', authenticateMiddleware, OcrController.getStatus);

router.post(
  '/:id/images/:imageId/ocr/reprocess',
  authenticateMiddleware,
  authorizeMiddleware(RoleCode.ADMIN, RoleCode.INSPECTOR),
  OcrController.reprocess
);

export const ocrRoutes = router;
