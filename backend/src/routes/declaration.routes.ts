import { Router } from 'express';
import { DeclarationController } from '../controllers/declaration.controller';
import { authenticateMiddleware } from '../middleware/authenticate';
import { authorizeMiddleware } from '../middleware/authorize';
import { RoleCode } from '@prisma/client';

export const declarationRoutes = Router();

declarationRoutes.use(authenticateMiddleware);

// Extract declarations from OCR result (ADMIN, INSPECTOR)
declarationRoutes.post(
  '/:id/images/:imageId/ocr/:ocrResultId/extract',
  authorizeMiddleware(RoleCode.ADMIN, RoleCode.INSPECTOR),
  DeclarationController.extractDeclarations
);

// Re-extract declarations from OCR result (ADMIN, INSPECTOR)
declarationRoutes.post(
  '/:id/images/:imageId/ocr/:ocrResultId/reextract',
  authorizeMiddleware(RoleCode.ADMIN, RoleCode.INSPECTOR),
  DeclarationController.reextractDeclarations
);

// List all declarations for an inspection (ADMIN, INSPECTOR, REVIEWER)
declarationRoutes.get(
  '/:id/declarations',
  authorizeMiddleware(RoleCode.ADMIN, RoleCode.INSPECTOR, RoleCode.REVIEWER),
  DeclarationController.getDeclarationsByInspection
);

// Get single declaration by ID (ADMIN, INSPECTOR, REVIEWER)
declarationRoutes.get(
  '/:id/declarations/:declarationId',
  authorizeMiddleware(RoleCode.ADMIN, RoleCode.INSPECTOR, RoleCode.REVIEWER),
  DeclarationController.getDeclarationById
);
