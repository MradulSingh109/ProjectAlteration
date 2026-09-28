import { prisma } from "@/infrastructure/database/prisma";
import {
  IDrillingEventRepository,
  CreateDrillingEventInput,
  ListDrillingEventsFilter,
  DrillingEventWithSource,
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
        sourceDocument: {
          select: {
            id: true,
            filename: true,
            mimeType: true,
            documentType: true,
          },
        },
      },
    });

    if (!row) return null;

    return {
      event: mapDrillingEvent(row),
      sourceDocument: {
        id: row.sourceDocument.id,
        filename: row.sourceDocument.filename,
        mimeType: row.sourceDocument.mimeType,
        documentType: row.sourceDocument.documentType,
      },
    };
  }

  async listByWellId(
    wellId: string,
    filter?: ListDrillingEventsFilter,
  ): Promise<DrillingEventEntity[]> {
    const rows = await this.db.drillingEvent.findMany({
      where: {
        wellId,
        ...(filter?.eventType ? { eventType: filter.eventType } : {}),
        ...(filter?.severity ? { severity: filter.severity } : {}),
        ...(filter?.reviewStatus ? { reviewStatus: filter.reviewStatus } : {}),
      },
      orderBy: [{ depthMd: "asc" }, { createdAt: "desc" }],
    });

    return rows.map(mapDrillingEvent);
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
