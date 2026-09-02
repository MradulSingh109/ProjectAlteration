import { Request, Response, NextFunction } from 'express';
import { InspectionService } from '../services/inspection.service';
import {
  createInspectionSchema,
  updateInspectionSchema,
  updateInspectionStatusSchema,
  inspectionQuerySchema,
} from '../schemas/inspection.schema';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/AppError';

export class InspectionController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED');
      }

      const parseResult = createInspectionSchema.safeParse(req.body);

      if (!parseResult.success) {
        const issue = parseResult.error.issues[0];
        throw AppError.badRequest(
          issue ? issue.message : 'Invalid inspection creation input',
          'VALIDATION_ERROR'
        );
      }

      const userAgentHeader = req.get('user-agent');
      const reqCtx = {
        ip: req.ip,
        userAgent: Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader,
      };

      const inspection = await InspectionService.createInspection(
        parseResult.data,
        req.user,
        reqCtx
      );

      sendSuccess(res, { inspection }, 201);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED');
      }

      const id = req.params.id as string;
      if (!id) {
        throw AppError.badRequest('Inspection ID parameter is required', 'VALIDATION_ERROR');
      }

      const inspection = await InspectionService.getInspectionById(id, req.user);
      sendSuccess(res, { inspection }, 200);
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED');
      }

      const parseResult = inspectionQuerySchema.safeParse(req.query);

      if (!parseResult.success) {
        const issue = parseResult.error.issues[0];
        throw AppError.badRequest(
          issue ? issue.message : 'Invalid inspection query parameters',
          'VALIDATION_ERROR'
        );
      }

      const result = await InspectionService.listInspections(parseResult.data, req.user);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED');
      }

      const id = req.params.id as string;
      if (!id) {
        throw AppError.badRequest('Inspection ID parameter is required', 'VALIDATION_ERROR');
      }

      const parseResult = updateInspectionSchema.safeParse(req.body);

      if (!parseResult.success) {
        const issue = parseResult.error.issues[0];
        throw AppError.badRequest(
          issue ? issue.message : 'Invalid inspection update input',
          'VALIDATION_ERROR'
        );
      }

      const userAgentHeader = req.get('user-agent');
      const reqCtx = {
        ip: req.ip,
        userAgent: Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader,
      };

      const inspection = await InspectionService.updateInspection(
        id,
        parseResult.data,
        req.user,
        reqCtx
      );

      sendSuccess(res, { inspection }, 200);
    } catch (error) {
      next(error);
    }
  }

  static async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED');
      }

      const id = req.params.id as string;
      if (!id) {
        throw AppError.badRequest('Inspection ID parameter is required', 'VALIDATION_ERROR');
      }

      const parseResult = updateInspectionStatusSchema.safeParse(req.body);

      if (!parseResult.success) {
        const issue = parseResult.error.issues[0];
        throw AppError.badRequest(
          issue ? issue.message : 'Invalid status transition input',
          'VALIDATION_ERROR'
        );
      }

      const userAgentHeader = req.get('user-agent');
      const reqCtx = {
        ip: req.ip,
        userAgent: Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader,
      };

      const inspection = await InspectionService.updateInspectionStatus(
        id,
        parseResult.data.status,
        req.user,
        reqCtx
      );

      sendSuccess(res, { inspection }, 200);
    } catch (error) {
      next(error);
    }
  }
}

