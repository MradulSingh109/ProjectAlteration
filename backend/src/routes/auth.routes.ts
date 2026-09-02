import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticateMiddleware } from '../middleware/authenticate';

const router = Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.get('/me', authenticateMiddleware, AuthController.getMe);
router.post('/logout', AuthController.logout);

export const authRoutes = router;
