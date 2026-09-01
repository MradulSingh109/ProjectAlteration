import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';

export const notFoundMiddleware = (req: Request, res: Response, _next: NextFunction): void => {
  sendError(res, `Route ${req.method} ${req.originalUrl} not found`, 404, 'ROUTE_NOT_FOUND');
};
