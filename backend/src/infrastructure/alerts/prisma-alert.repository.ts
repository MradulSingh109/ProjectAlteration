import { prisma } from "@/infrastructure/database/prisma";
import {
  Prisma,
  PrismaClient,
  AlertStatus as PrismaAlertStatus,
  EventSeverity,
} from "@prisma/client";
import {
  IAlertRepository,
  UpdateAlertStatusInput,
} from "@/domain/alerts/alert.repository.interface";
import {
  AlertEntity,
  AlertEvidence,
  AlertStatus,
  AlertSeverity,
  CreateAlertInput,
  ListAlertsFilter,
  PaginatedAlertsResult,
  RuleConditions,
} from "@/domain/alerts/alert.entity";

function mapAlert(row: {
  id: string;
  wellId: string;
  ruleVersionId: string;
  telemetryReadingId: string;
  alertType: string;
  severity: EventSeverity;
  status: PrismaAlertStatus;
  triggeredAt: Date;
  acknowledgedAt: Date | null;
  acknowledgedBy: string | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  resolutionNotes: string | null;
  explanation: string;
  evidence: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
  well?: {
    id: string;
    wellId: string;
    name: string;
    field: string;
  } | null;
  ruleVersion?: {
    id: string;
    ruleId: string;
    version: number;
    isActive: boolean;
    severity: EventSeverity;
    conditions: Prisma.JsonValue;
    description: string | null;
    createdAt: Date;
    rule?: {
      id: string;
      ruleCode: string;
      name: string;
      description: string;
      eventType: string;
      isEnabled: boolean;
      createdAt: Date;
      updatedAt: Date;
    } | null;
  } | null;
}): AlertEntity {
  return {
    id: row.id,
    wellId: row.wellId,
    ruleVersionId: row.ruleVersionId,
    telemetryReadingId: row.telemetryReadingId,
    alertType: row.alertType,
    severity: row.severity as AlertSeverity,
    status: row.status as AlertStatus,
    triggeredAt: row.triggeredAt,
    acknowledgedAt: row.acknowledgedAt,
    acknowledgedBy: row.acknowledgedBy,
    resolvedAt: row.resolvedAt,
    resolvedBy: row.resolvedBy,
    resolutionNotes: row.resolutionNotes,
    explanation: row.explanation,
    evidence: row.evidence as unknown as AlertEvidence,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    well: row.well
      ? {
          id: row.well.id,
          wellId: row.well.wellId,
          name: row.well.name,
          field: row.well.field,
        }
      : undefined,
    ruleVersion: row.ruleVersion
      ? {
          id: row.ruleVersion.id,
          ruleId: row.ruleVersion.ruleId,
          version: row.ruleVersion.version,
          isActive: row.ruleVersion.isActive,
          severity: row.ruleVersion.severity as AlertSeverity,
          conditions: row.ruleVersion.conditions as RuleConditions,
          description: row.ruleVersion.description,
          createdAt: row.ruleVersion.createdAt,
          rule: row.ruleVersion.rule
            ? {
                id: row.ruleVersion.rule.id,
                ruleCode: row.ruleVersion.rule.ruleCode,
                name: row.ruleVersion.rule.name,
                description: row.ruleVersion.rule.description,
                eventType: row.ruleVersion.rule.eventType,
                isEnabled: row.ruleVersion.rule.isEnabled,
                createdAt: row.ruleVersion.rule.createdAt,
                updatedAt: row.ruleVersion.rule.updatedAt,
              }
            : undefined,
        }
      : undefined,
  };
}

export class PrismaAlertRepository implements IAlertRepository {
  constructor(private readonly prismaClient: PrismaClient = prisma) {}

  async create(data: CreateAlertInput): Promise<AlertEntity> {
    const row = await this.prismaClient.alert.create({
      data: {
        wellId: data.wellId,
        ruleVersionId: data.ruleVersionId,
        telemetryReadingId: data.telemetryReadingId,
        alertType: data.alertType,
        severity: data.severity,
        triggeredAt: data.triggeredAt,
        explanation: data.explanation,
        evidence: data.evidence as unknown as Prisma.InputJsonValue,
      },
      include: {
        well: true,
        ruleVersion: {
          include: {
            rule: true,
          },
        },
      },
    });

    return mapAlert(row);
  }

  async findById(id: string): Promise<AlertEntity | null> {
    const row = await this.prismaClient.alert.findUnique({
      where: { id },
      include: {
        well: true,
        ruleVersion: {
          include: {
            rule: true,
          },
        },
      },
    });

    return row ? mapAlert(row) : null;
  }

  async findByReadingAndRuleVersion(
    telemetryReadingId: string,
    ruleVersionId: string,
  ): Promise<AlertEntity | null> {
    const row = await this.prismaClient.alert.findUnique({
      where: {
        telemetryReadingId_ruleVersionId: {
          telemetryReadingId,
          ruleVersionId,
        },
      },
      include: {
        well: true,
        ruleVersion: {
          include: {
            rule: true,
          },
        },
      },
    });

    return row ? mapAlert(row) : null;
  }

  async listByWellId(
    wellId: string,
    filter?: ListAlertsFilter,
  ): Promise<PaginatedAlertsResult> {
    const page = Math.max(1, filter?.page || 1);
    const pageSize = Math.min(100, Math.max(1, filter?.pageSize || 20));
    const sortOrder: Prisma.SortOrder =
      filter?.sortOrder === "asc" ? "asc" : "desc";

    const where: Prisma.AlertWhereInput = {
      wellId,
    };

    if (filter?.status) {
      where.status = filter.status as PrismaAlertStatus;
    }

    if (filter?.severity) {
      where.severity = filter.severity;
    }

    if (filter?.alertType) {
      where.alertType = filter.alertType;
    }

    if (filter?.ruleCode) {
      where.ruleVersion = {
        rule: {
          ruleCode: filter.ruleCode,
        },
      };
    }

    if (filter?.from || filter?.to) {
      where.triggeredAt = {};
      if (filter.from) {
        where.triggeredAt.gte = filter.from;
      }
      if (filter.to) {
        where.triggeredAt.lte = filter.to;
      }
    }

    const [totalItems, rows] = await Promise.all([
      this.prismaClient.alert.count({ where }),
      this.prismaClient.alert.findMany({
        where,
        include: {
          well: true,
          ruleVersion: {
            include: {
              rule: true,
            },
          },
        },
        orderBy: {
          triggeredAt: sortOrder,
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const totalPages =
      Math.ceil(totalItems / pageSize) || (totalItems === 0 ? 0 : 1);

    return {
      items: rows.map((r) => mapAlert(r)),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
    };
  }

  async updateStatus(
    id: string,
    input: UpdateAlertStatusInput,
  ): Promise<AlertEntity> {
    const data: Prisma.AlertUpdateInput = {
      status: input.status as PrismaAlertStatus,
    };

    if (input.acknowledgedAt !== undefined) {
      data.acknowledgedAt = input.acknowledgedAt;
    }
    if (input.acknowledgedBy !== undefined) {
      data.acknowledgedBy = input.acknowledgedBy;
    }
    if (input.resolvedAt !== undefined) {
      data.resolvedAt = input.resolvedAt;
    }
    if (input.resolvedBy !== undefined) {
      data.resolvedBy = input.resolvedBy;
    }
    if (input.resolutionNotes !== undefined) {
      data.resolutionNotes = input.resolutionNotes;
    }

    const row = await this.prismaClient.alert.update({
      where: { id },
      data,
      include: {
        well: true,
        ruleVersion: {
          include: {
            rule: true,
          },
        },
      },
    });

    return mapAlert(row);
  }
}

export const alertRepository = new PrismaAlertRepository();
