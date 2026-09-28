import { prisma } from "@/infrastructure/database/prisma";
import {
  IDrillingEventRepository,
  CreateDrillingEventInput,
  ListDrillingEventsFilter,
  DrillingEventWithSource,
  PaginatedResult,
  WellEventSummary,
} from "@/domain/events/drilling-event.repository.interface";
import {
  DrillingEventEntity,
  EventType,
  EventSeverity,
  ReviewStatus,
} from "@/domain/events/drilling-event.entity";
import { Prisma, PrismaClient } from "@prisma/client";

function toDecimalNumber(val: any): number {
  if (val && typeof val === "object" && "toNumber" in val) {
    return val.toNumber();
  }
  return Number(val);
}

function mapDrillingEvent(row: any): DrillingEventEntity {
  return {
    id: row.id,
    wellId: row.wellId,
    eventType: row.eventType as EventType,
    depthMd: toDecimalNumber(row.depthMd),
    depthTvd: row.depthTvd ? toDecimalNumber(row.depthTvd) : null,
    formation: row.formation,
    severity: row.severity as EventSeverity,
    description: row.description,
    cause: row.cause,
    mitigation: row.mitigation,
    outcome: row.outcome,
    sourceDocumentId: row.sourceDocumentId,
    sourcePage: row.sourcePage,
    extractionConfidence: toDecimalNumber(row.extractionConfidence),
    reviewStatus: row.reviewStatus as ReviewStatus,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function buildPrismaWhereClause(
  base: { wellId?: string; sourceDocumentId?: string },
  filter?: ListDrillingEventsFilter,
): Prisma.DrillingEventWhereInput {
  const where: Prisma.DrillingEventWhereInput = {};

  if (base.wellId) {
    where.wellId = base.wellId;
  }
  if (base.sourceDocumentId) {
    where.sourceDocumentId = base.sourceDocumentId;
  }
  if (filter?.sourceDocumentId && !base.sourceDocumentId) {
    where.sourceDocumentId = filter.sourceDocumentId;
  }
  if (filter?.eventType) {
    where.eventType = filter.eventType;
  }
  if (filter?.severity) {
    where.severity = filter.severity;
  }
  if (filter?.reviewStatus) {
    where.reviewStatus = filter.reviewStatus;
  }
  if (filter?.formation) {
    where.formation = { contains: filter.formation, mode: "insensitive" };
  }
  if (filter?.minDepthMd !== undefined || filter?.maxDepthMd !== undefined) {
    where.depthMd = {};
    if (filter.minDepthMd !== undefined) {
      where.depthMd.gte = new Prisma.Decimal(filter.minDepthMd.toString());
    }
    if (filter.maxDepthMd !== undefined) {
      where.depthMd.lte = new Prisma.Decimal(filter.maxDepthMd.toString());
    }
  }
  if (filter?.minDepthTvd !== undefined || filter?.maxDepthTvd !== undefined) {
    where.depthTvd = {};
    if (filter.minDepthTvd !== undefined) {
      where.depthTvd.gte = new Prisma.Decimal(filter.minDepthTvd.toString());
    }
    if (filter.maxDepthTvd !== undefined) {
      where.depthTvd.lte = new Prisma.Decimal(filter.maxDepthTvd.toString());
    }
  }
  if (
    filter?.minConfidence !== undefined ||
    filter?.maxConfidence !== undefined
  ) {
    where.extractionConfidence = {};
    if (filter.minConfidence !== undefined) {
      where.extractionConfidence.gte = new Prisma.Decimal(
        filter.minConfidence.toString(),
      );
    }
    if (filter.maxConfidence !== undefined) {
      where.extractionConfidence.lte = new Prisma.Decimal(
        filter.maxConfidence.toString(),
      );
    }
  }

  return where;
}

function buildPrismaOrderBy(
  filter?: ListDrillingEventsFilter,
): Prisma.DrillingEventOrderByWithRelationInput {
  const sortBy = filter?.sortBy ?? "createdAt";
  const sortOrder = filter?.sortOrder ?? "desc";

  return { [sortBy]: sortOrder };
}

export class PrismaDrillingEventRepository implements IDrillingEventRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async create(data: CreateDrillingEventInput): Promise<DrillingEventEntity> {
    const event = await this.db.drillingEvent.create({
      data: {
        ...(data.id ? { id: data.id } : {}),
        wellId: data.wellId,
        eventType: data.eventType,
        depthMd: new Prisma.Decimal(data.depthMd.toString()),
        depthTvd:
          data.depthTvd !== undefined && data.depthTvd !== null
            ? new Prisma.Decimal(data.depthTvd.toString())
            : null,
        formation: data.formation ?? null,
        severity: data.severity,
        description: data.description,
        cause: data.cause ?? null,
        mitigation: data.mitigation ?? null,
        outcome: data.outcome ?? null,
        sourceDocumentId: data.sourceDocumentId,
        sourcePage: data.sourcePage,
        extractionConfidence: new Prisma.Decimal(
          data.extractionConfidence.toString(),
        ),
        reviewStatus: data.reviewStatus || ReviewStatus.PENDING_REVIEW,
        reviewedBy: data.reviewedBy ?? null,
        reviewedAt: data.reviewedAt ?? null,
      },
    });

    return mapDrillingEvent(event);
  }

  async findById(id: string): Promise<DrillingEventEntity | null> {
    const event = await this.db.drillingEvent.findUnique({
      where: { id },
    });
    return event ? mapDrillingEvent(event) : null;
  }

  async findByIdWithSource(
    id: string,
  ): Promise<DrillingEventWithSource | null> {
    const row = await this.db.drillingEvent.findUnique({
      where: { id },
      include: {
        well: {
          select: {
            id: true,
            wellId: true,
            name: true,
            field: true,
          },
        },
        sourceDocument: {
          select: {
            id: true,
            filename: true,
            mimeType: true,
            documentType: true,
            fileSize: true,
            fileHash: true,
            uploadedAt: true,
            ingestionStatus: true,
          },
        },
      },
    });

    if (!row) return null;

    return {
      event: mapDrillingEvent(row),
      well: row.well
        ? {
            id: row.well.id,
            wellId: row.well.wellId,
            name: row.well.name,
            field: row.well.field,
          }
        : undefined,
      sourceDocument: {
        id: row.sourceDocument.id,
        filename: row.sourceDocument.filename,
        mimeType: row.sourceDocument.mimeType,
        documentType: row.sourceDocument.documentType,
        fileSize: row.sourceDocument.fileSize,
        fileHash: row.sourceDocument.fileHash,
        uploadedAt: row.sourceDocument.uploadedAt,
        ingestionStatus: row.sourceDocument.ingestionStatus,
      },
    };
  }

  async listByWellId(
    wellId: string,
    filter?: ListDrillingEventsFilter,
  ): Promise<PaginatedResult<DrillingEventEntity> & DrillingEventEntity[]> {
    const where = buildPrismaWhereClause({ wellId }, filter);
    const orderBy = buildPrismaOrderBy(filter);

    const page = Math.max(1, filter?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filter?.pageSize ?? 20));
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const [totalItems, rows] = await Promise.all([
      this.db.drillingEvent.count({ where }),
      this.db.drillingEvent.findMany({
        where,
        skip,
        take,
        orderBy,
      }),
    ]);

    const mappedItems = rows.map(mapDrillingEvent);
    const totalPages = Math.ceil(totalItems / pageSize) || 1;

    return Object.assign(mappedItems, {
      items: mappedItems,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
    });
  }

  async listByDocumentId(
    documentId: string,
    filter?: ListDrillingEventsFilter,
  ): Promise<PaginatedResult<DrillingEventEntity> & DrillingEventEntity[]> {
    const where = buildPrismaWhereClause(
      { sourceDocumentId: documentId },
      filter,
    );
    const orderBy = buildPrismaOrderBy(filter);

    const page = Math.max(1, filter?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filter?.pageSize ?? 20));
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const [totalItems, rows] = await Promise.all([
      this.db.drillingEvent.count({ where }),
      this.db.drillingEvent.findMany({
        where,
        skip,
        take,
        orderBy,
      }),
    ]);

    const mappedItems = rows.map(mapDrillingEvent);
    const totalPages = Math.ceil(totalItems / pageSize) || 1;

    return Object.assign(mappedItems, {
      items: mappedItems,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
    });
  }

  async getSummaryByWellId(wellId: string): Promise<WellEventSummary> {
    const [
      totalEvents,
      byEventTypeRaw,
      bySeverityRaw,
      byReviewStatusRaw,
      byFormationRaw,
    ] = await Promise.all([
      this.db.drillingEvent.count({ where: { wellId } }),
      this.db.drillingEvent.groupBy({
        by: ["eventType"],
        where: { wellId },
        _count: { id: true },
      }),
      this.db.drillingEvent.groupBy({
        by: ["severity"],
        where: { wellId },
        _count: { id: true },
      }),
      this.db.drillingEvent.groupBy({
        by: ["reviewStatus"],
        where: { wellId },
        _count: { id: true },
      }),
      this.db.drillingEvent.groupBy({
        by: ["formation"],
        where: { wellId, formation: { not: null } },
        _count: { id: true },
      }),
    ]);

    const byEventType: Record<string, number> = {};
    for (const g of byEventTypeRaw) {
      byEventType[g.eventType] = g._count.id;
    }

    const bySeverity: Record<string, number> = {};
    for (const g of bySeverityRaw) {
      bySeverity[g.severity] = g._count.id;
    }

    const byReviewStatus: Record<string, number> = {};
    for (const g of byReviewStatusRaw) {
      byReviewStatus[g.reviewStatus] = g._count.id;
    }

    const byFormation: Record<string, number> = {};
    for (const g of byFormationRaw) {
      if (g.formation) {
        byFormation[g.formation] = g._count.id;
      }
    }

    return {
      wellId,
      totalEvents,
      byEventType,
      bySeverity,
      byReviewStatus,
      byFormation,
    };
  }

  async update(
    id: string,
    data: Partial<DrillingEventEntity>,
  ): Promise<DrillingEventEntity> {
    const updateData: any = {};

    if (data.eventType !== undefined) updateData.eventType = data.eventType;
    if (data.severity !== undefined) updateData.severity = data.severity;
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.cause !== undefined) updateData.cause = data.cause;
    if (data.mitigation !== undefined) updateData.mitigation = data.mitigation;
    if (data.outcome !== undefined) updateData.outcome = data.outcome;
    if (data.formation !== undefined) updateData.formation = data.formation;
    if (data.sourcePage !== undefined) updateData.sourcePage = data.sourcePage;
    if (data.sourceDocumentId !== undefined)
      updateData.sourceDocumentId = data.sourceDocumentId;
    if (data.reviewStatus !== undefined)
      updateData.reviewStatus = data.reviewStatus;
    if (data.reviewedBy !== undefined) updateData.reviewedBy = data.reviewedBy;
    if (data.reviewedAt !== undefined) updateData.reviewedAt = data.reviewedAt;

    if (data.depthMd !== undefined) {
      updateData.depthMd = new Prisma.Decimal(data.depthMd.toString());
    }
    if (data.depthTvd !== undefined) {
      updateData.depthTvd =
        data.depthTvd !== null
          ? new Prisma.Decimal(data.depthTvd.toString())
          : null;
    }
    if (data.extractionConfidence !== undefined) {
      updateData.extractionConfidence = new Prisma.Decimal(
        data.extractionConfidence.toString(),
      );
    }

    const updated = await this.db.drillingEvent.update({
      where: { id },
      data: updateData,
    });

    return mapDrillingEvent(updated);
  }

  async delete(id: string): Promise<void> {
    try {
      await this.db.drillingEvent.delete({
        where: { id },
      });
    } catch (error: any) {
      if (error && error.code === "P2025") {
        return; // Idempotent
      }
      throw error;
    }
  }
}

export const drillingEventRepository = new PrismaDrillingEventRepository();
