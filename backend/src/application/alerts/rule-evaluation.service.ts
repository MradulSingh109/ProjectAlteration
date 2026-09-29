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
import {
  AlertEntity,
  AlertRuleVersionEntity,
} from "@/domain/alerts/alert.entity";
import { WellEntity } from "@/domain/wells/well.entity";
import { CanonicalTelemetryReading } from "@/domain/telemetry/telemetry.entity";
import {
  AlertDetailResponseDto,
  toAlertDetailResponseDto,
  EvaluateRangeDto,
  MAX_EVALUATION_WINDOW_MS,
  MAX_EVALUATION_READINGS_LIMIT,
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
   * Builds a strictly chronologically sorted window of recent telemetry readings
   * ending at the current target reading.
   */
  private buildChronologicalWindow(
    historyItems: CanonicalTelemetryReading[],
    currentReading: CanonicalTelemetryReading,
    windowSize: number,
  ): CanonicalTelemetryReading[] {
    const readingMap = new Map<string, CanonicalTelemetryReading>();
    for (const r of historyItems) {
      if (r.timestamp.getTime() <= currentReading.timestamp.getTime()) {
        readingMap.set(r.id, r);
      }
    }
    readingMap.set(currentReading.id, currentReading);

    const sorted = Array.from(readingMap.values()).sort((a, b) => {
      const timeDiff = a.timestamp.getTime() - b.timestamp.getTime();
      if (timeDiff !== 0) return timeDiff;
      return Number(a.sequenceNumber - b.sequenceNumber);
    });

    return sorted.slice(-windowSize);
  }

  /**
   * Internal helper to evaluate a single reading against active rule versions.
   * Idempotently persists any triggered alerts with race condition protection.
   */
  private async evaluateSingleReading(
    reading: CanonicalTelemetryReading,
    well: WellEntity,
    activeVersions: AlertRuleVersionEntity[],
    recentReadings?: CanonicalTelemetryReading[],
    actorId?: string,
    actorRole?: string,
  ): Promise<AlertEntity[]> {
    const triggeredAlerts: AlertEntity[] = [];

    // Evaluate each active rule deterministically
    for (const ruleVersion of activeVersions) {
      // 1. Evaluate pure condition in-memory first (0ms)
      const outcome = this.evaluator.evaluate(
        ruleVersion,
        reading,
        well
          ? { id: well.id, wellId: well.wellId, name: well.name }
          : undefined,
        recentReadings,
      );

      // If condition was not met, skip without database roundtrips
      if (!outcome.triggered || !outcome.explanation || !outcome.evidence) {
        continue;
      }

      // 2. Only if triggered: check if alert already exists for (readingId, ruleVersionId)
      const existingAlert = await this.alertRepo.findByReadingAndRuleVersion(
        reading.id,
        ruleVersion.id,
      );

      if (existingAlert) {
        triggeredAlerts.push(existingAlert);
        continue;
      }

      const alertType =
        ruleVersion.rule?.ruleCode === "MUD_FLOW_DISCREPANCY_DETECT"
          ? "MUD_FLOW_DISCREPANCY"
          : ruleVersion.rule?.eventType || "DRILLING_ANOMALY";

      try {
        const created = await this.alertRepo.create({
          wellId: reading.wellId,
          ruleVersionId: ruleVersion.id,
          telemetryReadingId: reading.id,
          alertType,
          severity: ruleVersion.severity,
          triggeredAt: reading.timestamp,
          explanation: outcome.explanation,
          evidence: outcome.evidence,
        });

        triggeredAlerts.push(created);

        // Durable audit log (never store secrets)
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
          const raceExisting = await this.alertRepo.findByReadingAndRuleVersion(
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

    return triggeredAlerts;
  }

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

    // Determine max consecutive readings required across active rules
    const maxConsecutive = activeVersions.reduce((max, rv) => {
      if (rv.conditions.type === "DELTA" && rv.conditions.consecutiveReadings) {
        return Math.max(max, rv.conditions.consecutiveReadings);
      }
      return max;
    }, 1);

    // Fetch chronological history if any sustained rule requires multiple readings
    let recentReadings: CanonicalTelemetryReading[] | undefined = undefined;
    if (maxConsecutive > 1) {
      const history = await this.telemetryRepo.listByWellId(reading.wellId, {
        to: reading.timestamp,
        pageSize: maxConsecutive * 2,
        sortOrder: "desc",
      });
      recentReadings = this.buildChronologicalWindow(
        history.items,
        reading,
        maxConsecutive,
      );
    }

    const triggeredAlerts = await this.evaluateSingleReading(
      reading,
      well,
      activeVersions,
      recentReadings,
      actorId,
      actorRole,
    );

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
   * Enforces mandatory chronological bounds, maximum time window, and maximum reading limit.
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

    if (query.from.getTime() > query.to.getTime()) {
      throw AppError.badRequest(
        "from date must be earlier than or equal to to date",
      );
    }

    const durationMs = query.to.getTime() - query.from.getTime();
    if (durationMs > MAX_EVALUATION_WINDOW_MS) {
      throw AppError.badRequest(
        `Evaluation window duration (${(durationMs / (60 * 60 * 1000)).toFixed(1)}h) exceeds maximum allowed limit of ${MAX_EVALUATION_WINDOW_MS / (60 * 60 * 1000)} hours`,
      );
    }

    if (query.limit != null && query.limit > MAX_EVALUATION_READINGS_LIMIT) {
      throw AppError.badRequest(
        `limit cannot exceed ${MAX_EVALUATION_READINGS_LIMIT} readings per evaluation`,
      );
    }

    const limit = Math.min(
      MAX_EVALUATION_READINGS_LIMIT,
      Math.max(1, query.limit || 50),
    );

    const readingsResult = await this.telemetryRepo.listByWellId(wellId, {
      from: query.from,
      to: query.to,
      page: 1,
      pageSize: limit,
      sortOrder: "asc",
    });

    if (readingsResult.items.length === 0) {
      return {
        wellId,
        readingsEvaluatedCount: 0,
        alertsTriggeredCount: 0,
        alerts: [],
      };
    }

    const activeVersions = await this.ruleRepo.listActiveRuleVersions();

    const maxConsecutive = activeVersions.reduce((max, rv) => {
      if (rv.conditions.type === "DELTA" && rv.conditions.consecutiveReadings) {
        return Math.max(max, rv.conditions.consecutiveReadings);
      }
      return max;
    }, 1);

    // Pre-fetch any readings strictly before 'query.from' to populate initial history if maxConsecutive > 1
    let priorReadings: CanonicalTelemetryReading[] = [];
    if (maxConsecutive > 1) {
      const priorHistory = await this.telemetryRepo.listByWellId(wellId, {
        to: query.from,
        pageSize: maxConsecutive,
        sortOrder: "desc",
      });
      priorReadings = priorHistory.items.filter(
        (r) => !readingsResult.items.some((it) => it.id === r.id),
      );
    }

    // Build complete chronological timeline
    const chronologicalBuffer = [
      ...priorReadings,
      ...readingsResult.items,
    ].sort((a, b) => {
      const timeDiff = a.timestamp.getTime() - b.timestamp.getTime();
      if (timeDiff !== 0) return timeDiff;
      return Number(a.sequenceNumber - b.sequenceNumber);
    });

    const allTriggeredAlerts: AlertEntity[] = [];

    for (const reading of readingsResult.items) {
      let recentReadings: CanonicalTelemetryReading[] | undefined = undefined;
      if (maxConsecutive > 1) {
        const idx = chronologicalBuffer.findIndex((r) => r.id === reading.id);
        const windowSlice =
          idx >= 0
            ? chronologicalBuffer.slice(
                Math.max(0, idx - maxConsecutive + 1),
                idx + 1,
              )
            : [reading];
        recentReadings = windowSlice;
      }

      const readingAlerts = await this.evaluateSingleReading(
        reading,
        well,
        activeVersions,
        recentReadings,
        actorId,
        actorRole,
      );

      for (const alert of readingAlerts) {
        if (!allTriggeredAlerts.some((a) => a.id === alert.id)) {
          allTriggeredAlerts.push(alert);
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
