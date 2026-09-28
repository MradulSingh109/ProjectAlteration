import { z } from "zod";
import {
  AlertEntity,
  AlertStatus,
  VALID_ALERT_STATUSES,
  AlertEvidence,
} from "@/domain/alerts/alert.entity";
import { EventSeverity } from "@prisma/client";

/**
 * Query schema for retrieving alerts associated with a well.
 */
export const queryAlertsSchema = z
  .object({
    status: z
      .enum(VALID_ALERT_STATUSES as [AlertStatus, ...AlertStatus[]])
      .optional(),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
    alertType: z.string().trim().optional(),
    ruleCode: z.string().trim().optional(),
    from: z
      .string()
      .trim()
      .datetime({ message: "from must be a valid ISO 8601 datetime string" })
      .optional()
      .transform((v) => (v ? new Date(v) : undefined)),
    to: z
      .string()
      .trim()
      .datetime({ message: "to must be a valid ISO 8601 datetime string" })
      .optional()
      .transform((v) => (v ? new Date(v) : undefined)),
    page: z.coerce
      .number()
      .int("page must be an integer")
      .min(1, "page must be greater than or equal to 1")
      .default(1),
    pageSize: z.coerce
      .number()
      .int("pageSize must be an integer")
      .min(1, "pageSize must be greater than or equal to 1")
      .max(100, "pageSize cannot exceed 100")
      .default(20),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .refine(
    (data) => {
      if (data.from && data.to && data.from.getTime() > data.to.getTime()) {
        return false;
      }
      return true;
    },
    {
      message: "from date must be earlier than or equal to to date",
      path: ["from"],
    },
  );

export interface QueryAlertsDto {
  status?: AlertStatus;
  severity?: EventSeverity;
  alertType?: string;
  ruleCode?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
  sortOrder?: "asc" | "desc";
}

/**
 * Schema for alert resolution payload.
 */
export const resolveAlertSchema = z.object({
  resolutionNotes: z
    .string()
    .trim()
    .max(1000, "resolutionNotes cannot exceed 1000 characters")
    .optional()
    .nullable(),
});

export type ResolveAlertDto = z.infer<typeof resolveAlertSchema>;

/**
 * Schema for bounded range evaluation.
 */
export const evaluateRangeSchema = z
  .object({
    from: z
      .string()
      .trim()
      .datetime({ message: "from must be a valid ISO 8601 datetime string" })
      .optional()
      .transform((v) => (v ? new Date(v) : undefined)),
    to: z
      .string()
      .trim()
      .datetime({ message: "to must be a valid ISO 8601 datetime string" })
      .optional()
      .transform((v) => (v ? new Date(v) : undefined)),
    limit: z.coerce
      .number()
      .int("limit must be an integer")
      .min(1, "limit must be at least 1")
      .max(100, "limit cannot exceed 100 readings per evaluation")
      .default(50),
  })
  .refine(
    (data) => {
      if (data.from && data.to && data.from.getTime() > data.to.getTime()) {
        return false;
      }
      return true;
    },
    {
      message: "from date must be earlier than or equal to to date",
      path: ["from"],
    },
  );

export interface EvaluateRangeDto {
  from?: Date;
  to?: Date;
  limit?: number;
}

/**
 * Clean API response representation for an Alert.
 */
export interface AlertResponseDto {
  id: string;
  wellId: string;
  ruleCode: string;
  ruleVersion: number;
  alertType: string;
  severity: EventSeverity;
  status: AlertStatus;
  triggeredAt: string;
  acknowledgedAt?: string | null;
  acknowledgedBy?: string | null;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  resolutionNotes?: string | null;
  explanation: string;
  evidence: AlertEvidence;
  createdAt: string;
  updatedAt: string;
}

/**
 * Detail response DTO with related well and rule context.
 */
export interface AlertDetailResponseDto extends AlertResponseDto {
  well?: {
    id: string;
    wellId: string;
    name: string;
    field: string;
  };
  rule?: {
    ruleCode: string;
    name: string;
    description: string;
    version: number;
  };
}

export function toAlertResponseDto(alert: AlertEntity): AlertResponseDto {
  return {
    id: alert.id,
    wellId: alert.wellId,
    ruleCode: alert.ruleVersion?.rule?.ruleCode || "UNKNOWN",
    ruleVersion: alert.ruleVersion?.version || 1,
    alertType: alert.alertType,
    severity: alert.severity,
    status: alert.status,
    triggeredAt: alert.triggeredAt.toISOString(),
    acknowledgedAt: alert.acknowledgedAt?.toISOString() || null,
    acknowledgedBy: alert.acknowledgedBy || null,
    resolvedAt: alert.resolvedAt?.toISOString() || null,
    resolvedBy: alert.resolvedBy || null,
    resolutionNotes: alert.resolutionNotes || null,
    explanation: alert.explanation,
    evidence: alert.evidence,
    createdAt: alert.createdAt.toISOString(),
    updatedAt: alert.updatedAt.toISOString(),
  };
}

export function toAlertDetailResponseDto(
  alert: AlertEntity,
): AlertDetailResponseDto {
  const base = toAlertResponseDto(alert);
  return {
    ...base,
    well: alert.well,
    rule: alert.ruleVersion
      ? {
          ruleCode: alert.ruleVersion.rule?.ruleCode || "UNKNOWN",
          name: alert.ruleVersion.rule?.name || "",
          description: alert.ruleVersion.rule?.description || "",
          version: alert.ruleVersion.version,
        }
      : undefined,
  };
}
