import { IAlertRepository } from "@/domain/alerts/alert.repository.interface";
import { alertRepository } from "@/infrastructure/alerts/prisma-alert.repository";
import { IWellRepository } from "@/domain/wells/well.repository.interface";
import { wellRepository } from "@/infrastructure/wells/prisma-well.repository";
import { IAuditLogRepository } from "@/domain/audit/audit-log.repository.interface";
import { auditLogRepository } from "@/infrastructure/audit/prisma-audit-log.repository";
import {
  AlertDetailResponseDto,
  toAlertDetailResponseDto,
  QueryAlertsDto,
} from "./alert.dto";
import { AlertStatus } from "@/domain/alerts/alert.entity";
import { AppError } from "@/lib/errors";

export interface PaginatedAlertsResponseDto {
  items: AlertDetailResponseDto[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

/**
 * Application service managing alert queries and lifecycle state machine.
 * Enforces valid state transitions:
 * - ACTIVE -> ACKNOWLEDGED
 * - ACKNOWLEDGED -> RESOLVED
 * - Direct ACTIVE -> RESOLVED is rejected (must acknowledge first).
 * - Reopening or invalid transitions are strictly rejected.
 */
export class AlertLifecycleService {
  constructor(
    private readonly alertRepo: IAlertRepository = alertRepository,
    private readonly wellRepo: IWellRepository = wellRepository,
    private readonly auditLogRepo: IAuditLogRepository = auditLogRepository,
  ) {}

  /**
   * Retrieves an alert by ID with full well and rule version details.
   */
  async getAlertById(alertId: string): Promise<AlertDetailResponseDto> {
    const alert = await this.alertRepo.findById(alertId);
    if (!alert) {
      throw AppError.notFound("Alert not found");
    }
    return toAlertDetailResponseDto(alert);
  }

  /**
   * Lists and filters alerts associated with a well.
   */
  async listAlertsForWell(
    wellId: string,
    filter: QueryAlertsDto,
  ): Promise<PaginatedAlertsResponseDto> {
    const well = await this.wellRepo.findById(wellId);
    if (!well) {
      throw AppError.notFound("Well not found");
    }

    const result = await this.alertRepo.listByWellId(wellId, filter);

    return {
      items: result.items.map(toAlertDetailResponseDto),
      pagination: result.pagination,
    };
  }

  /**
   * Acknowledges an active alert.
   */
  async acknowledgeAlert(
    alertId: string,
    actorId: string,
    actorRole: string,
  ): Promise<AlertDetailResponseDto> {
    const alert = await this.alertRepo.findById(alertId);
    if (!alert) {
      throw AppError.notFound("Alert not found");
    }

    if (alert.status === AlertStatus.ACKNOWLEDGED) {
      throw AppError.badRequest("Alert is already acknowledged");
    }

    if (alert.status === AlertStatus.RESOLVED) {
      throw AppError.badRequest("Cannot acknowledge an already resolved alert");
    }

    const updated = await this.alertRepo.updateStatus(alertId, {
      status: AlertStatus.ACKNOWLEDGED,
      acknowledgedAt: new Date(),
      acknowledgedBy: actorId,
    });

    try {
      await this.auditLogRepo.create({
        actorId,
        actorRole,
        action: "ALERT_ACKNOWLEDGE",
        resourceType: "ALERT",
        resourceId: updated.id,
        wellId: updated.wellId,
        details: {
          previousStatus: alert.status,
          newStatus: AlertStatus.ACKNOWLEDGED,
        },
      });
    } catch (auditErr) {
      console.warn("Failed to create alert acknowledge audit log:", auditErr);
    }

    return toAlertDetailResponseDto(updated);
  }

  /**
   * Resolves an acknowledged alert.
   * An alert must be acknowledged before it can be resolved.
   * Direct ACTIVE -> RESOLVED transition is rejected.
   */
  async resolveAlert(
    alertId: string,
    actorId: string,
    actorRole: string,
    resolutionNotes?: string | null,
  ): Promise<AlertDetailResponseDto> {
    const alert = await this.alertRepo.findById(alertId);
    if (!alert) {
      throw AppError.notFound("Alert not found");
    }

    if (alert.status === AlertStatus.RESOLVED) {
      throw AppError.badRequest("Alert has already been resolved");
    }

    if (alert.status === AlertStatus.ACTIVE) {
      throw AppError.badRequest(
        "Alert must be acknowledged before it can be resolved. Transition ACTIVE -> RESOLVED is not permitted.",
      );
    }

    const updated = await this.alertRepo.updateStatus(alertId, {
      status: AlertStatus.RESOLVED,
      resolvedAt: new Date(),
      resolvedBy: actorId,
      resolutionNotes: resolutionNotes || null,
    });

    try {
      await this.auditLogRepo.create({
        actorId,
        actorRole,
        action: "ALERT_RESOLVE",
        resourceType: "ALERT",
        resourceId: updated.id,
        wellId: updated.wellId,
        details: {
          previousStatus: alert.status,
          newStatus: AlertStatus.RESOLVED,
          hasResolutionNotes: !!resolutionNotes,
        },
      });
    } catch (auditErr) {
      console.warn("Failed to create alert resolve audit log:", auditErr);
    }

    return toAlertDetailResponseDto(updated);
  }
}

export const alertLifecycleService = new AlertLifecycleService();
