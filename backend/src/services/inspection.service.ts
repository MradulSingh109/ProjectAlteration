import { WorkflowStatus, ComplianceStatus, RoleCode, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import {
  CreateInspectionInput,
  UpdateInspectionInput,
  InspectionQueryInput,
} from '../schemas/inspection.schema';
import { generateInspectionNumber } from '../utils/inspectionNumber';
import { AuditService } from './audit.service';
import { AuthUser } from '../types/express';
import { AppError } from '../utils/AppError';

// Permitted workflow state transitions matrix
const ALLOWED_TRANSITIONS: Record<WorkflowStatus, WorkflowStatus[]> = {
  [WorkflowStatus.DRAFT]: [WorkflowStatus.PROCESSING, WorkflowStatus.CANCELLED],
  [WorkflowStatus.PROCESSING]: [WorkflowStatus.UNDER_REVIEW, WorkflowStatus.CANCELLED],
  [WorkflowStatus.UNDER_REVIEW]: [WorkflowStatus.PROCESSING, WorkflowStatus.COMPLETED],
  [WorkflowStatus.COMPLETED]: [],
  [WorkflowStatus.CANCELLED]: [],
};

const INSPECTION_SELECT_FIELDS = {
  id: true,
  inspectionNumber: true,
  workflowStatus: true,
  complianceStatus: true,
  remarks: true,
  inspectedAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  product: {
    select: {
      id: true,
      name: true,
      brandName: true,
      manufacturerName: true,
      category: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
  },
  creator: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
};

export class InspectionService {
  static async createInspection(
    input: CreateInspectionInput,
    user: AuthUser,
    reqCtx?: { ip?: string; userAgent?: string }
  ) {
    // 1. Verify target product exists and is active (not soft-deleted)
    const product = await prisma.product.findFirst({
      where: {
        id: input.productId,
        deletedAt: null,
      },
    });

    if (!product) {
      throw AppError.notFound(
        'Target product for inspection does not exist or has been deleted',
        'PRODUCT_NOT_FOUND'
      );
    }

    // 2. Retry loop for collision-safe inspection number generation
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      attempts++;
      const inspectionNumber = generateInspectionNumber();

      try {
        return await prisma.$transaction(async (tx) => {
          const inspection = await tx.inspection.create({
            data: {
              inspectionNumber,
              productId: input.productId,
              createdBy: user.id,
              workflowStatus: WorkflowStatus.DRAFT,
              complianceStatus: ComplianceStatus.REVIEW,
              remarks: input.remarks || null,
            },
            select: INSPECTION_SELECT_FIELDS,
          });

          await AuditService.logAction(
            {
              userId: user.id,
              action: 'INSPECTION_CREATED',
              entityType: 'Inspection',
              entityId: inspection.id,
              newValue: inspection as unknown as Record<string, unknown>,
              ipAddress: reqCtx?.ip,
              userAgent: reqCtx?.userAgent,
            },
            tx
          );

          return inspection;
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          attempts < maxAttempts
        ) {
          // Retry on unique constraint collision
          continue;
        }
        throw error;
      }
    }

    throw AppError.internal('Failed to generate a unique inspection number after multiple attempts');
  }

  static async getInspectionById(id: string, user: AuthUser) {
    const inspection = await prisma.inspection.findUnique({
      where: { id },
      select: INSPECTION_SELECT_FIELDS,
    });

    if (!inspection) {
      throw AppError.notFound('Inspection not found', 'INSPECTION_NOT_FOUND');
    }

    // Role-based visibility enforcement
    if (user.role === RoleCode.INSPECTOR && inspection.creator.id !== user.id) {
      throw AppError.forbidden(
        'Access denied. Inspectors may only view their own assigned inspections.',
        'FORBIDDEN'
      );
    }

    return inspection;
  }

  static async listInspections(query: InspectionQueryInput, user: AuthUser) {
    const {
      page,
      limit,
      workflowStatus,
      complianceStatus,
      productId,
      inspectionNumber,
      createdBy,
      fromDate,
      toDate,
      sortBy,
      sortOrder,
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.InspectionWhereInput = {};

    if (workflowStatus) {
      where.workflowStatus = workflowStatus;
    }

    if (complianceStatus) {
      where.complianceStatus = complianceStatus;
    }

    if (productId) {
      where.productId = productId;
    }

    if (inspectionNumber) {
      where.inspectionNumber = { contains: inspectionNumber, mode: 'insensitive' };
    }

    // Role-based list scoping
    if (user.role === RoleCode.INSPECTOR) {
      where.createdBy = user.id; // Force ownership restriction for INSPECTOR
    } else if (createdBy) {
      where.createdBy = createdBy; // ADMIN and REVIEWER can filter by createdBy if provided
    }

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) {
        where.createdAt.gte = new Date(fromDate);
      }
      if (toDate) {
        where.createdAt.lte = new Date(toDate);
      }
    }

    const [total, items] = await Promise.all([
      prisma.inspection.count({ where }),
      prisma.inspection.findMany({
        where,
        skip,
        take: limit,
        select: INSPECTION_SELECT_FIELDS,
        orderBy: { [sortBy]: sortOrder },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  static async updateInspection(
    id: string,
    input: UpdateInspectionInput,
    user: AuthUser,
    reqCtx?: { ip?: string; userAgent?: string }
  ) {
    const existing = await prisma.inspection.findUnique({
      where: { id },
      select: INSPECTION_SELECT_FIELDS,
    });

    if (!existing) {
      throw AppError.notFound('Inspection not found', 'INSPECTION_NOT_FOUND');
    }

    // Permissions check
    if (user.role === RoleCode.REVIEWER) {
      throw AppError.forbidden('Reviewers are not permitted to modify inspections', 'FORBIDDEN');
    }

    if (user.role === RoleCode.INSPECTOR && existing.creator.id !== user.id) {
      throw AppError.forbidden('Inspectors may only update their own inspections', 'FORBIDDEN');
    }

    // Editable state safety check: allow updates only when DRAFT or PROCESSING
    if (
      existing.workflowStatus !== WorkflowStatus.DRAFT &&
      existing.workflowStatus !== WorkflowStatus.PROCESSING
    ) {
      throw AppError.badRequest(
        `Cannot update inspection in '${existing.workflowStatus}' state. Only DRAFT or PROCESSING inspections are editable.`,
        'INVALID_WORKFLOW_STATE'
      );
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.inspection.update({
        where: { id },
        data: {
          remarks: input.remarks !== undefined ? input.remarks : existing.remarks,
        },
        select: INSPECTION_SELECT_FIELDS,
      });

      await AuditService.logAction(
        {
          userId: user.id,
          action: 'INSPECTION_UPDATED',
          entityType: 'Inspection',
          entityId: id,
          oldValue: existing as unknown as Record<string, unknown>,
          newValue: updated as unknown as Record<string, unknown>,
          ipAddress: reqCtx?.ip,
          userAgent: reqCtx?.userAgent,
        },
        tx
      );

      return updated;
    });
  }

  static async updateInspectionStatus(
    id: string,
    newStatus: WorkflowStatus,
    user: AuthUser,
    reqCtx?: { ip?: string; userAgent?: string }
  ) {
    const existing = await prisma.inspection.findUnique({
      where: { id },
      select: INSPECTION_SELECT_FIELDS,
    });

    if (!existing) {
      throw AppError.notFound('Inspection not found', 'INSPECTION_NOT_FOUND');
    }

    // Permissions check
    if (user.role === RoleCode.REVIEWER) {
      throw AppError.forbidden('Reviewers are not permitted to change inspection status', 'FORBIDDEN');
    }

    if (user.role === RoleCode.INSPECTOR && existing.creator.id !== user.id) {
      throw AppError.forbidden('Inspectors may only transition status of their own inspections', 'FORBIDDEN');
    }

    // Validate workflow state machine transition
    const validTargets = ALLOWED_TRANSITIONS[existing.workflowStatus] || [];
    if (!validTargets.includes(newStatus)) {
      throw AppError.badRequest(
        `Inspection cannot transition from ${existing.workflowStatus} to ${newStatus}`,
        'INVALID_STATUS_TRANSITION'
      );
    }

    // Server-controlled timestamps
    const completedAt = newStatus === WorkflowStatus.COMPLETED ? new Date() : existing.completedAt;

    return prisma.$transaction(async (tx) => {
      const updated = await tx.inspection.update({
        where: { id },
        data: {
          workflowStatus: newStatus,
          completedAt,
        },
        select: INSPECTION_SELECT_FIELDS,
      });

      await AuditService.logAction(
        {
          userId: user.id,
          action: 'INSPECTION_STATUS_CHANGED',
          entityType: 'Inspection',
          entityId: id,
          oldValue: {
            workflowStatus: existing.workflowStatus,
            completedAt: existing.completedAt,
          },
          newValue: {
            workflowStatus: updated.workflowStatus,
            completedAt: updated.completedAt,
          },
          ipAddress: reqCtx?.ip,
          userAgent: reqCtx?.userAgent,
        },
        tx
      );

      return updated;
    });
  }
}
