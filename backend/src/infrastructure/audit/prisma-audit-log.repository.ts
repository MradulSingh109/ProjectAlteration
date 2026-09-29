import { prisma } from "@/infrastructure/database/prisma";
import {
  IAuditLogRepository,
  CreateAuditLogInput,
  ListAuditLogsFilter,
} from "@/domain/audit/audit-log.repository.interface";
import { AuditLogEntity } from "@/domain/audit/audit-log.entity";
import { Prisma } from "@prisma/client";

/**
 * PostgreSQL Prisma implementation of durable audit log repository.
 */
export class PrismaAuditLogRepository implements IAuditLogRepository {
  async create(input: CreateAuditLogInput): Promise<AuditLogEntity> {
    const record = await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorRole: input.actorRole ?? null,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        wellId: input.wellId ?? null,
        details: input.details
          ? (input.details as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });

    return this.mapToEntity(record);
  }

  async list(filter?: ListAuditLogsFilter): Promise<AuditLogEntity[]> {
    const where: Prisma.AuditLogWhereInput = {};

    if (filter?.action) where.action = filter.action;
    if (filter?.resourceId) where.resourceId = filter.resourceId;
    if (filter?.wellId) where.wellId = filter.wellId;
    if (filter?.actorId) where.actorId = filter.actorId;

    const records = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return records.map((r) => this.mapToEntity(r));
  }

  async findById(id: string): Promise<AuditLogEntity | null> {
    const record = await prisma.auditLog.findUnique({
      where: { id },
    });

    return record ? this.mapToEntity(record) : null;
  }

  private mapToEntity(record: {
    id: string;
    actorId: string | null;
    actorRole: string | null;
    action: string;
    resourceType: string;
    resourceId: string | null;
    wellId: string | null;
    details: unknown;
    createdAt: Date;
  }): AuditLogEntity {
    return {
      id: record.id,
      actorId: record.actorId,
      actorRole: record.actorRole,
      action: record.action,
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      wellId: record.wellId,
      details: record.details
        ? (record.details as Record<string, unknown>)
        : null,
      createdAt: record.createdAt,
    };
  }
}

export const auditLogRepository = new PrismaAuditLogRepository();
