import { z } from 'zod';
import { WorkflowStatus, ComplianceStatus } from '@prisma/client';

export const createInspectionSchema = z.object({
  productId: z
    .string({ required_error: 'Product ID is required' })
    .uuid('Invalid product ID format'),
  remarks: z
    .string()
    .trim()
    .max(1000, 'Remarks must not exceed 1000 characters')
    .optional(),
});

export const updateInspectionSchema = z.object({
  remarks: z
    .string()
    .trim()
    .max(1000, 'Remarks must not exceed 1000 characters')
    .optional(),
});

export const updateInspectionStatusSchema = z.object({
  status: z.nativeEnum(WorkflowStatus, {
    errorMap: () => ({ message: 'Invalid workflow status transition target' }),
  }),
});

export const inspectionQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .refine((val) => !isNaN(val) && val >= 1, { message: 'page must be a positive integer' }),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .refine((val) => !isNaN(val) && val >= 1 && val <= 100, { message: 'limit must be between 1 and 100' }),
  workflowStatus: z.nativeEnum(WorkflowStatus).optional(),
  complianceStatus: z.nativeEnum(ComplianceStatus).optional(),
  productId: z.string().uuid('Invalid product ID format').optional(),
  inspectionNumber: z.string().trim().optional(),
  createdBy: z.string().uuid('Invalid creator ID format').optional(),
  fromDate: z.string().datetime({ message: 'fromDate must be a valid ISO 8601 date-time string' }).optional(),
  toDate: z.string().datetime({ message: 'toDate must be a valid ISO 8601 date-time string' }).optional(),
  sortBy: z.enum(['createdAt', 'inspectedAt', 'inspectionNumber', 'workflowStatus', 'complianceStatus']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateInspectionInput = z.infer<typeof createInspectionSchema>;
export type UpdateInspectionInput = z.infer<typeof updateInspectionSchema>;
export type UpdateInspectionStatusInput = z.infer<typeof updateInspectionStatusSchema>;
export type InspectionQueryInput = z.infer<typeof inspectionQuerySchema>;
