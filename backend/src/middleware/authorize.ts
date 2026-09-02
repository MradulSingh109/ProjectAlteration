import { Request, Response, NextFunction } from 'express';
import { RoleCode } from '@prisma/client';
import { AppError } from '../utils/AppError';

export const authorizeMiddleware = (...allowedRoles: RoleCode[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(
        AppError.unauthorized(
          'Authentication required before authorization',
          'UNAUTHORIZED'
        )
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        AppError.forbidden(
          `Permission denied. Required role: [${allowedRoles.join(', ')}]. Your role: [${req.user.role}]`,
          'FORBIDDEN'
        )
      );
    }

    next();
  };
};
