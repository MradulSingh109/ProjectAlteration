import { prisma } from "@/infrastructure/database/prisma";
import { Prisma, PrismaClient, EventSeverity, EventType } from "@prisma/client";
import { IAlertRuleRepository } from "@/domain/alerts/rule.repository.interface";
import {
  AlertRuleEntity,
  AlertRuleVersionEntity,
  AlertSeverity,
  RuleConditions,
} from "@/domain/alerts/alert.entity";
import { INITIAL_ALERT_RULES } from "@/domain/alerts/initial-rules";

function mapRule(row: {
  id: string;
  ruleCode: string;
  name: string;
  description: string;
  eventType: string;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  versions?: {
    id: string;
    ruleId: string;
    version: number;
    isActive: boolean;
    severity: EventSeverity;
    conditions: Prisma.JsonValue;
    description: string | null;
    createdAt: Date;
  }[];
}): AlertRuleEntity {
  return {
    id: row.id,
    ruleCode: row.ruleCode,
    name: row.name,
    description: row.description,
    eventType: row.eventType,
    isEnabled: row.isEnabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    versions: row.versions
      ? row.versions.map((v) => mapVersion(v, row))
      : undefined,
  };
}

function mapVersion(
  row: {
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
    };
  },
  parentRule?: {
    id: string;
    ruleCode: string;
    name: string;
    description: string;
    eventType: string;
    isEnabled: boolean;
    createdAt: Date;
    updatedAt: Date;
  },
): AlertRuleVersionEntity {
  const ruleData = row.rule || parentRule;
  return {
    id: row.id,
    ruleId: row.ruleId,
    version: row.version,
    isActive: row.isActive,
    severity: row.severity as AlertSeverity,
    conditions: row.conditions as RuleConditions,
    description: row.description,
    createdAt: row.createdAt,
    rule: ruleData
      ? {
          id: ruleData.id,
          ruleCode: ruleData.ruleCode,
          name: ruleData.name,
          description: ruleData.description,
          eventType: ruleData.eventType,
          isEnabled: ruleData.isEnabled,
          createdAt: ruleData.createdAt,
          updatedAt: ruleData.updatedAt,
        }
      : undefined,
  };
}

export class PrismaAlertRuleRepository implements IAlertRuleRepository {
  private isSeeded = false;

  constructor(private readonly prismaClient: PrismaClient = prisma) {}

  async listActiveRuleVersions(): Promise<AlertRuleVersionEntity[]> {
    if (!this.isSeeded) {
      await this.seedInitialRulesIfEmpty();
      this.isSeeded = true;
    }

    const rows = await this.prismaClient.alertRuleVersion.findMany({
      where: {
        isActive: true,
        rule: {
          isEnabled: true,
        },
      },
      include: {
        rule: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return rows.map((r) => mapVersion(r));
  }

  async findRuleByCode(ruleCode: string): Promise<AlertRuleEntity | null> {
    const row = await this.prismaClient.alertRule.findUnique({
      where: { ruleCode },
      include: {
        versions: {
          orderBy: { version: "desc" },
        },
      },
    });

    return row ? mapRule(row) : null;
  }

  async findVersionById(
    versionId: string,
  ): Promise<AlertRuleVersionEntity | null> {
    const row = await this.prismaClient.alertRuleVersion.findUnique({
      where: { id: versionId },
      include: { rule: true },
    });

    return row ? mapVersion(row) : null;
  }

  async createRule(rule: {
    ruleCode: string;
    name: string;
    description: string;
    eventType: string;
  }): Promise<AlertRuleEntity> {
    const row = await this.prismaClient.alertRule.create({
      data: {
        ruleCode: rule.ruleCode,
        name: rule.name,
        description: rule.description,
        eventType: rule.eventType as EventType,
      },
    });

    return mapRule(row);
  }

  async createRuleVersion(version: {
    ruleId: string;
    version: number;
    isActive: boolean;
    severity: AlertSeverity;
    conditions: RuleConditions;
    description?: string | null;
  }): Promise<AlertRuleVersionEntity> {
    const row = await this.prismaClient.alertRuleVersion.create({
      data: {
        ruleId: version.ruleId,
        version: version.version,
        isActive: version.isActive,
        severity: version.severity,
        conditions: version.conditions as Prisma.InputJsonValue,
        description: version.description,
      },
      include: {
        rule: true,
      },
    });

    return mapVersion(row);
  }

  /**
   * Automatically seeds initial deterministic demonstration rules if none exist.
   */
  async seedInitialRulesIfEmpty(): Promise<void> {
    for (const ruleDef of INITIAL_ALERT_RULES) {
      let rule = await this.prismaClient.alertRule.findUnique({
        where: { ruleCode: ruleDef.ruleCode },
      });

      if (!rule) {
        rule = await this.prismaClient.alertRule.create({
          data: {
            ruleCode: ruleDef.ruleCode,
            name: ruleDef.name,
            description: ruleDef.description,
            eventType: ruleDef.eventType as EventType,
            isEnabled: true,
          },
        });
      }

      const existingVersion =
        await this.prismaClient.alertRuleVersion.findUnique({
          where: {
            ruleId_version: {
              ruleId: rule.id,
              version: ruleDef.version,
            },
          },
        });

      if (!existingVersion) {
        await this.prismaClient.alertRuleVersion.create({
          data: {
            ruleId: rule.id,
            version: ruleDef.version,
            isActive: true,
            severity: ruleDef.severity,
            conditions: ruleDef.conditions as Prisma.InputJsonValue,
            description: ruleDef.versionDescription,
          },
        });
      } else {
        // Ensure conditions are synchronized with canonical rule definition
        await this.prismaClient.alertRuleVersion.update({
          where: { id: existingVersion.id },
          data: {
            conditions: ruleDef.conditions as Prisma.InputJsonValue,
            description: ruleDef.versionDescription,
          },
        });
      }
    }
  }
}

export const alertRuleRepository = new PrismaAlertRuleRepository();
