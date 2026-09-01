import { Response } from 'express';
import { ApiSuccessResponse, ApiErrorResponse } from '../types/api.types';

export const sendSuccess = <T>(
  res: Response,
  data: T,
  statusCode: number = 200
): Response<ApiSuccessResponse<T>> => {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
    error: null,
  };
  return res.status(statusCode).json(response);
};

export const sendError = (
  res: Response,
  message: string,
  statusCode: number = 500,
  code: string = 'INTERNAL_SERVER_ERROR',
  details?: unknown
): Response<ApiErrorResponse> => {
  const response: ApiErrorResponse = {
    success: false,
    data: null,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  };
  return res.status(statusCode).json(response);
};
