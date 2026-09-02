import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';

export interface AuditLogOptions {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class AuditService {
  /**
   * Creates an AuditLog record. Accepts optional Prisma transaction client for atomic execution.
   */
  static async logAction(
    options: AuditLogOptions,
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    const client = tx || prisma;

    await client.auditLog.create({
      data: {
        userId: options.userId || null,
        action: options.action,
        entityType: options.entityType,
        entityId: options.entityId,
        oldValue: options.oldValue ? (options.oldValue as Prisma.InputJsonValue) : Prisma.JsonNull,
        newValue: options.newValue ? (options.newValue as Prisma.InputJsonValue) : Prisma.JsonNull,
        ipAddress: options.ipAddress || null,
        userAgent: options.userAgent || null,
      },
    });
  }
}
