import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';
import { authenticateMiddleware } from '../middleware/authenticate';
import { authorizeMiddleware } from '../middleware/authorize';
import { RoleCode } from '@prisma/client';

const router = Router();

// Category routes
router.get('/product-categories', authenticateMiddleware, ProductController.listCategories);

// Product routes
router.get('/products', authenticateMiddleware, ProductController.listProducts);
router.get('/products/:id', authenticateMiddleware, ProductController.getProductById);
router.post(
  '/products',
  authenticateMiddleware,
  authorizeMiddleware(RoleCode.ADMIN, RoleCode.INSPECTOR),
  ProductController.createProduct
);

export const productRoutes = router;
