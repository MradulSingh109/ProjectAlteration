import { Router } from 'express';
import healthRoutes from './health.routes';
import { authRoutes } from './auth.routes';

const router = Router();

// Mount health routes under /health
router.use('/health', healthRoutes);

// Mount auth routes under /auth
router.use('/auth', authRoutes);

export default router;
