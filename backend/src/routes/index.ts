import { Router } from 'express';
import healthRoutes from './health.routes';
import { authRoutes } from './auth.routes';
import { productRoutes } from './product.routes';
import { inspectionRoutes } from './inspection.routes';
import { inspectionImageRoutes } from './inspectionImage.routes';
import { ocrRoutes } from './ocr.routes';
import { declarationRoutes } from './declaration.routes';
import { complianceRoutes } from './compliance.routes';
import { reviewRoutes } from './review.routes';
import { inspectionReportRoutes, dashboardReportRoutes } from './report.routes';

const router = Router();

// Mount health routes under /health
router.use('/health', healthRoutes);

// Mount auth routes under /auth
router.use('/auth', authRoutes);

// Mount product & category routes
router.use('/', productRoutes);

// Mount inspection routes under /inspections
router.use('/inspections', inspectionRoutes);
router.use('/inspections', inspectionImageRoutes);
router.use('/inspections', ocrRoutes);
router.use('/inspections', declarationRoutes);
router.use('/inspections', complianceRoutes);
router.use('/inspections', reviewRoutes);
router.use('/inspections', inspectionReportRoutes);

// Mount dashboard report routes under /reports
router.use('/reports', dashboardReportRoutes);

export default router;
