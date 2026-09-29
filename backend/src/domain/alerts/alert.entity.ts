import { EventSeverity } from "@prisma/client";

/**
 * Standardized lifecycle status of an alert.
 */
export const AlertStatus = {
  ACTIVE: "ACTIVE",
  ACKNOWLEDGED: "ACKNOWLEDGED",
  RESOLVED: "RESOLVED",
} as const;

export type AlertStatus = (typeof AlertStatus)[keyof typeof AlertStatus];

export const VALID_ALERT_STATUSES: AlertStatus[] = [
  AlertStatus.ACTIVE,
  AlertStatus.ACKNOWLEDGED,
  AlertStatus.RESOLVED,
];

export type AlertSeverity = EventSeverity;

/**
 * Strongly typed conditions supported by deterministic rule evaluators.
 */
export type RuleConditions =
  | {
      type: "THRESHOLD";
      metric: "standpipePressure" | "surfaceTorque" | "annularPressure";
      operator: ">" | ">=" | "<" | "<=";
      threshold: number;
      unit: string;
    }
  | {
      type: "DELTA";
      metricA: "flowRateIn";
      metricB: "flowRateOut";
      operator: ">";
      threshold: number; // delta difference threshold
      unit: string;
      consecutiveReadings: number; // required consecutive readings for sustained discrepancy
    };

/**
 * Domain entity representing an alert rule definition.
 */
export interface AlertRuleEntity {
  id: string;
  ruleCode: string;
  name: string;
  description: string;
  eventType: string;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  versions?: AlertRuleVersionEntity[];
}

/**
 * Domain entity representing an immutable version of an alert rule.
 */
export interface AlertRuleVersionEntity {
  id: string;
  ruleId: string;
  version: number;
  isActive: boolean;
  severity: AlertSeverity;
  conditions: RuleConditions;
  description?: string | null;
  createdAt: Date;
  rule?: AlertRuleEntity;
}

/**
 * Snapshot evidence explaining exactly why an alert was triggered.
 */
export interface AlertEvidence {
  metric: string;
  observedValue: number | Record<string, number | null>;
  threshold: number | Record<string, number>;
  unit: string;
  measurementTimestamp: string;
  readingSequenceNumber: number;
  depthMd: number;
  conditionDescription: string;
}

/**
 * Domain entity representing an auditable, deterministic alert.
 */
export interface AlertEntity {
  id: string;
  wellId: string;
  ruleVersionId: string;
  telemetryReadingId: string;
  alertType: string;
  severity: AlertSeverity;
  status: AlertStatus;
  triggeredAt: Date;
  acknowledgedAt?: Date | null;
  acknowledgedBy?: string | null;
  resolvedAt?: Date | null;
  resolvedBy?: string | null;
  resolutionNotes?: string | null;
  explanation: string;
  evidence: AlertEvidence;
  createdAt: Date;
  updatedAt: Date;
  well?: {
    id: string;
    wellId: string;
    name: string;
    field: string;
  };
  ruleVersion?: AlertRuleVersionEntity;
}

/**
 * Input for creating a persistent alert.
 */
export interface CreateAlertInput {
  wellId: string;
  ruleVersionId: string;
  telemetryReadingId: string;
  alertType: string;
  severity: AlertSeverity;
  triggeredAt: Date;
  explanation: string;
  evidence: AlertEvidence;
}

/**
 * Query filter criteria for retrieving alerts.
 */
export interface ListAlertsFilter {
  status?: AlertStatus;
  severity?: AlertSeverity;
  alertType?: string;
  ruleCode?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
  sortOrder?: "asc" | "desc";
}

export interface AlertPaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PaginatedAlertsResult {
  items: AlertEntity[];
  pagination: AlertPaginationMeta;
}
