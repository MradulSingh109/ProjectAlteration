import { Request, Response } from 'express';
import { env } from '../config/env';
import { sendSuccess } from '../utils/response';
import { HealthCheckData } from '../types/api.types';

export const getHealth = (_req: Request, res: Response): void => {
  const healthData: HealthCheckData = {
    status: 'ok',
    service: 'sih26034-backend',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };

  sendSuccess(res, healthData, 200);
};
