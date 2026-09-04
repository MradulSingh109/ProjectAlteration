import { z } from 'zod';
import { ViolationStatus, ViolationSeverity, ComplianceStatus, WorkflowStatus } from '@prisma/client';

export const updateViolationStatusSchema = z.object({
  status: z.nativeEnum(ViolationStatus, {
    errorMap: () => ({ message: 'Invalid violation status value' }),
  }),
  comment: z.string().trim().max(1000, 'Comment must not exceed 1000 characters').optional(),
});

export type UpdateViolationStatusInput = z.infer<typeof updateViolationStatusSchema>;

export const reviewDecisionEnum = z.enum(['APPROVE', 'REJECT', 'REQUEST_CHANGES']);
export type ReviewDecision = z.infer<typeof reviewDecisionEnum>;

export const reviewInspectionSchema = z.object({
  decision: reviewDecisionEnum,
  comments: z.string().trim().max(2000, 'Comments must not exceed 2000 characters').optional(),
});

export type ReviewInspectionInput = z.infer<typeof reviewInspectionSchema>;

export interface ViolationQueryFilter {
  page?: number;
  limit?: number;
  status?: ViolationStatus;
  severity?: ViolationSeverity;
  validationResultId?: string;
}

export interface ReviewActionResult {
  inspectionId: string;
  previousWorkflowStatus: WorkflowStatus;
  newWorkflowStatus: WorkflowStatus;
  previousComplianceStatus: ComplianceStatus;
  newComplianceStatus: ComplianceStatus;
  decision: ReviewDecision;
  comments?: string;
  reviewedBy: string;
  reviewedAt: Date;
}
