import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';
import { sendError } from '../utils/response';
import { logger } from '../config/logger';
import { env } from '../config/env';

export const errorHandlerMiddleware: ErrorRequestHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Handle AppError instance
  if (err instanceof AppError) {
    logger.warn({ err, statusCode: err.statusCode, errorCode: err.errorCode }, err.message);
    sendError(res, err.message, err.statusCode, err.errorCode, err.details);
    return;
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    logger.warn({ issues: err.issues }, 'Validation Error');
    sendError(
      res,
      'Validation failed',
      400,
      'VALIDATION_ERROR',
      err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }))
    );
    return;
  }

  // Handle unexpected internal server errors
  logger.error({ err }, 'Unhandled Internal Server Error');

  const message = env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
  sendError(res, message, 500, 'INTERNAL_SERVER_ERROR');
};
