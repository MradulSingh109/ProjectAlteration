import { RoleCode, ViolationStatus, WorkflowStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import { AuthUser } from '../../types/express';
import { UpdateViolationStatusInput, ViolationQueryFilter } from './types';
import { AuditService } from '../audit.service';

export class ViolationReviewService {
  /**
   * Retrieves paginated violations for an inspection with status/severity filters and RBAC checks.
   */
  static async listViolations(
    inspectionId: string,
    query: ViolationQueryFilter,
    user: AuthUser
  ) {
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
    });

    if (!inspection) {
      throw AppError.notFound('Inspection not found', 'INSPECTION_NOT_FOUND');
    }

    if (user.role === RoleCode.INSPECTOR && inspection.createdBy !== user.id) {
      throw AppError.forbidden(
        'Access denied. Inspectors may only view violations for their own inspections.',
        'FORBIDDEN'
      );
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {
      inspectionId,
      ...(query.status && { status: query.status }),
      ...(query.severity && { severity: query.severity }),
      ...(query.validationResultId && { validationResultId: query.validationResultId }),
    };

    const [total, violations] = await Promise.all([
      prisma.violation.count({ where }),
      prisma.violation.findMany({
        where,
        include: {
          evidences: {
            include: {
              declaration: true,
              image: true,
              ocrResult: true,
            },
          },
          validationResult: {
            include: {
              ruleVersion: {
                include: {
                  rule: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      violations,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieves a single violation with cross-inspection relationship validation and RBAC.
   */
  static async getViolationById(inspectionId: string, violationId: string, user: AuthUser) {
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
    });

    if (!inspection) {
      throw AppError.notFound('Inspection not found', 'INSPECTION_NOT_FOUND');
    }

    if (user.role === RoleCode.INSPECTOR && inspection.createdBy !== user.id) {
      throw AppError.forbidden(
        'Access denied. Inspectors may only view violations for their own inspections.',
        'FORBIDDEN'
      );
    }

    const violation = await prisma.violation.findUnique({
      where: { id: violationId },
      include: {
        evidences: {
          include: {
            declaration: true,
            image: true,
            ocrResult: true,
          },
        },
        validationResult: {
          include: {
            ruleVersion: {
              include: {
                rule: true,
              },
            },
          },
        },
      },
    });

    if (!violation || violation.inspectionId !== inspectionId) {
      throw AppError.violationNotFound(
        'Violation record not found or does not belong to specified inspection'
      );
    }

    return violation;
  }

  /**
   * Updates violation status with transition validation, audit logging, and RBAC enforcement.
   */
  static async updateViolationStatus(
    inspectionId: string,
    violationId: string,
    input: UpdateViolationStatusInput,
    user: AuthUser,
    reqCtx?: { ip?: string; userAgent?: string }
  ) {
    // 1. RBAC authorization (Only ADMIN and REVIEWER can review/change violation status)
    if (user.role === RoleCode.INSPECTOR) {
      throw AppError.forbidden(
        'Inspectors are not permitted to modify violation statuses during review',
        'FORBIDDEN'
      );
    }

    // 2. Fetch Inspection
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
    });

    if (!inspection) {
      throw AppError.notFound('Inspection not found', 'INSPECTION_NOT_FOUND');
    }

    // 3. Workflow State Checks
    if (
      inspection.workflowStatus === WorkflowStatus.COMPLETED ||
      inspection.workflowStatus === WorkflowStatus.CANCELLED
    ) {
      throw AppError.inspectionNotEditable(
        `Cannot update violation status for an inspection in '${inspection.workflowStatus}' status.`
      );
    }

    // 4. Fetch Violation and verify ownership/relationship
    const violation = await prisma.violation.findUnique({
      where: { id: violationId },
    });

    if (!violation || violation.inspectionId !== inspectionId) {
      throw AppError.violationNotFound(
        'Violation record not found or does not belong to specified inspection'
      );
    }

    // 5. Validate Status Transition
    if (violation.status === input.status) {
      throw AppError.invalidViolationStatusTransition(
        `Violation is already in '${violation.status}' status.`
      );
    }

    const currentStatus = violation.status;
    const targetStatus = input.status;

    // Define allowed transitions matrix
    const allowedTransitions: Record<ViolationStatus, ViolationStatus[]> = {
      [ViolationStatus.OPEN]: [
        ViolationStatus.CONFIRMED,
        ViolationStatus.DISMISSED,
        ViolationStatus.RESOLVED,
      ],
      [ViolationStatus.CONFIRMED]: [
        ViolationStatus.OPEN,
        ViolationStatus.DISMISSED,
        ViolationStatus.RESOLVED,
      ],
      [ViolationStatus.RESOLVED]: [ViolationStatus.OPEN, ViolationStatus.CONFIRMED],
      [ViolationStatus.DISMISSED]: [ViolationStatus.OPEN, ViolationStatus.CONFIRMED],
    };

    if (!allowedTransitions[currentStatus].includes(targetStatus)) {
      throw AppError.invalidViolationStatusTransition(
        `Transitioning violation status from '${currentStatus}' to '${targetStatus}' is invalid.`
      );
    }

    // 6. Calculate resolvedAt
    const isTerminal =
      targetStatus === ViolationStatus.RESOLVED || targetStatus === ViolationStatus.DISMISSED;
    const resolvedAt = isTerminal ? new Date() : null;

    // 7. Update Violation in DB
    const updatedViolation = await prisma.violation.update({
      where: { id: violationId },
      data: {
        status: targetStatus,
        resolvedAt,
      },
      include: {
        evidences: {
          include: {
            declaration: true,
            image: true,
            ocrResult: true,
          },
        },
        validationResult: {
          include: {
            ruleVersion: {
              include: {
                rule: true,
              },
            },
          },
        },
      },
    });

    // 8. Log Audit Action
    await AuditService.logAction({
      userId: user.id,
      action: 'VIOLATION_STATUS_CHANGED',
      entityType: 'Violation',
      entityId: violationId,
      oldValue: {
        status: currentStatus,
      },
      newValue: {
        status: targetStatus,
        comment: input.comment || null,
        inspectionId,
      },
      ipAddress: reqCtx?.ip,
      userAgent: reqCtx?.userAgent,
    });

    return updatedViolation;
  }
}
