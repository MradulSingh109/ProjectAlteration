import { IAlertRepository } from "@/domain/alerts/alert.repository.interface";
import { alertRepository } from "@/infrastructure/alerts/prisma-alert.repository";
import { IAlertRuleRepository } from "@/domain/alerts/rule.repository.interface";
import { alertRuleRepository } from "@/infrastructure/alerts/prisma-rule.repository";
import { ITelemetryRepository } from "@/domain/telemetry/telemetry.repository.interface";
import { telemetryRepository } from "@/infrastructure/telemetry/prisma-telemetry.repository";
import { IWellRepository } from "@/domain/wells/well.repository.interface";
import { wellRepository } from "@/infrastructure/wells/prisma-well.repository";
import { IAuditLogRepository } from "@/domain/audit/audit-log.repository.interface";
import { auditLogRepository } from "@/infrastructure/audit/prisma-audit-log.repository";
import { IRuleEvaluator } from "@/domain/alerts/rule-evaluator.interface";
import { deterministicRuleEvaluator } from "@/domain/alerts/deterministic-evaluator";
import { AlertEntity } from "@/domain/alerts/alert.entity";
import {
  AlertDetailResponseDto,
  toAlertDetailResponseDto,
  EvaluateRangeDto,
} from "./alert.dto";
import { AppError } from "@/lib/errors";
import { Prisma } from "@prisma/client";

export interface ReadingEvaluationResultDto {
  readingId: string;
  wellId: string;
  evaluatedRulesCount: number;
  alertsTriggeredCount: number;
  alerts: AlertDetailResponseDto[];
}

export interface RangeEvaluationResultDto {
  wellId: string;
  readingsEvaluatedCount: number;
  alertsTriggeredCount: number;
  alerts: AlertDetailResponseDto[];
}

/**
 * Application service for deterministic telemetry alert rule evaluation.
 */
export class RuleEvaluationService {
  constructor(
    private readonly alertRepo: IAlertRepository = alertRepository,
    private readonly ruleRepo: IAlertRuleRepository = alertRuleRepository,
    private readonly telemetryRepo: ITelemetryRepository = telemetryRepository,
    private readonly wellRepo: IWellRepository = wellRepository,
    private readonly auditLogRepo: IAuditLogRepository = auditLogRepository,
    private readonly evaluator: IRuleEvaluator = deterministicRuleEvaluator,
  ) {}

  /**
   * Evaluates a single persisted telemetry reading against all active rule versions.
   * Idempotently persists any triggered alerts with race condition protection.
   */
  async evaluateReading(
    readingId: string,
    actorId?: string,
    actorRole?: string,
  ): Promise<ReadingEvaluationResultDto> {
    // 1. Fetch telemetry reading
    const reading = await this.telemetryRepo.findById(readingId);
    if (!reading) {
      throw AppError.notFound("Telemetry reading not found");
    }

    // 2. Fetch target well
    const well = await this.wellRepo.findById(reading.wellId);
    if (!well) {
      throw AppError.notFound("Referenced well not found");
    }

    // 3. Resolve active rule versions
    const activeVersions = await this.ruleRepo.listActiveRuleVersions();

    const triggeredAlerts: AlertEntity[] = [];

    // 4. Evaluate each active rule deterministically
    for (const ruleVersion of activeVersions) {
      // 4a. Check if alert already exists for (readingId, ruleVersionId)
      const existingAlert = await this.alertRepo.findByReadingAndRuleVersion(
        reading.id,
        ruleVersion.id,
      );

      if (existingAlert) {
        triggeredAlerts.push(existingAlert);
        continue;
      }

      // 4b. Evaluate pure condition
      const outcome = this.evaluator.evaluate(
        ruleVersion,
        reading,
        well
          ? { id: well.id, wellId: well.wellId, name: well.name }
          : undefined,
      );

      if (outcome.triggered && outcome.explanation && outcome.evidence) {
        try {
          const created = await this.alertRepo.create({
            wellId: reading.wellId,
            ruleVersionId: ruleVersion.id,
            telemetryReadingId: reading.id,
            alertType: ruleVersion.rule?.eventType || "DRILLING_ANOMALY",
            severity: ruleVersion.severity,
            triggeredAt: reading.timestamp,
            explanation: outcome.explanation,
            evidence: outcome.evidence,
          });

          triggeredAlerts.push(created);

          // 4c. Durable audit log (never store secrets)
          try {
            await this.auditLogRepo.create({
              actorId: actorId || "SYSTEM",
              actorRole: actorRole || "SYSTEM",
              action: "ALERT_GENERATE",
              resourceType: "ALERT",
              resourceId: created.id,
              wellId: reading.wellId,
              details: {
                ruleCode: ruleVersion.rule?.ruleCode,
                ruleVersion: ruleVersion.version,
                telemetryReadingId: reading.id,
                severity: created.severity,
                metric: outcome.evidence.metric,
              },
            });
          } catch (auditErr) {
            console.warn("Failed to create alert audit log:", auditErr);
          }
        } catch (error: unknown) {
          // Handle concurrent duplicate insertion race condition
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
          ) {
            const raceExisting =
              await this.alertRepo.findByReadingAndRuleVersion(
                reading.id,
                ruleVersion.id,
              );
            if (raceExisting) {
              triggeredAlerts.push(raceExisting);
            }
          } else {
            throw error;
          }
        }
      }
    }

    return {
      readingId: reading.id,
      wellId: reading.wellId,
      evaluatedRulesCount: activeVersions.length,
      alertsTriggeredCount: triggeredAlerts.length,
      alerts: triggeredAlerts.map(toAlertDetailResponseDto),
    };
  }

  /**
   * Evaluates telemetry readings within a bounded time range for a well.
   * Maximum 100 readings per evaluation window to ensure predictable latency.
   */
  async evaluateWellRange(
    wellId: string,
    query: EvaluateRangeDto,
    actorId?: string,
    actorRole?: string,
  ): Promise<RangeEvaluationResultDto> {
    const well = await this.wellRepo.findById(wellId);
    if (!well) {
      throw AppError.notFound("Well not found");
    }

    const limit = Math.min(100, Math.max(1, query.limit || 50));

    const readingsResult = await this.telemetryRepo.listByWellId(wellId, {
      from: query.from,
      to: query.to,
      page: 1,
      pageSize: limit,
      sortOrder: "asc",
    });

    const allTriggeredAlerts: AlertEntity[] = [];

    for (const reading of readingsResult.items) {
      const readingEval = await this.evaluateReading(
        reading.id,
        actorId,
        actorRole,
      );
      // Map back to AlertEntity or accumulate DTOs
      for (const alertDto of readingEval.alerts) {
        if (!allTriggeredAlerts.some((a) => a.id === alertDto.id)) {
          const alert = await this.alertRepo.findById(alertDto.id);
          if (alert) allTriggeredAlerts.push(alert);
        }
      }
    }

    return {
      wellId,
      readingsEvaluatedCount: readingsResult.items.length,
      alertsTriggeredCount: allTriggeredAlerts.length,
      alerts: allTriggeredAlerts.map(toAlertDetailResponseDto),
    };
  }
}

export const ruleEvaluationService = new RuleEvaluationService();
