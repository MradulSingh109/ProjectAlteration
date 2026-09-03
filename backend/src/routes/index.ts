import { Router } from 'express';
import healthRoutes from './health.routes';
import { authRoutes } from './auth.routes';
import { productRoutes } from './product.routes';
import { inspectionRoutes } from './inspection.routes';
import { inspectionImageRoutes } from './inspectionImage.routes';

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

export default router;
