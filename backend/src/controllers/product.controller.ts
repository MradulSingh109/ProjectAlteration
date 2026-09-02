import { Request, Response, NextFunction } from 'express';
import { ProductService } from '../services/product.service';
import { createProductSchema, productQuerySchema } from '../schemas/product.schema';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/AppError';

export class ProductController {
  static async listCategories(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const categories = await ProductService.listCategories();
      sendSuccess(res, { categories }, 200);
    } catch (error) {
      next(error);
    }
  }

  static async listProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parseResult = productQuerySchema.safeParse(req.query);

      if (!parseResult.success) {
        const issue = parseResult.error.issues[0];
        throw AppError.badRequest(issue ? issue.message : 'Invalid product query parameters', 'VALIDATION_ERROR');
      }

      const result = await ProductService.listProducts(parseResult.data);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  static async getProductById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      if (!id) {
        throw AppError.badRequest('Product ID parameter is required', 'VALIDATION_ERROR');
      }

      const product = await ProductService.getProductById(id);
      sendSuccess(res, { product }, 200);
    } catch (error) {
      next(error);
    }
  }

  static async createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED');
      }

      const parseResult = createProductSchema.safeParse(req.body);

      if (!parseResult.success) {
        const issue = parseResult.error.issues[0];
        throw AppError.badRequest(issue ? issue.message : 'Invalid product creation input', 'VALIDATION_ERROR');
      }

      const userAgentHeader = req.get('user-agent');
      const reqCtx = {
        ip: req.ip,
        userAgent: Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader,
      };

      const product = await ProductService.createProduct(parseResult.data, req.user.id, reqCtx);
      sendSuccess(res, { product }, 201);
    } catch (error) {
      next(error);
    }
  }
}
