/**
 * Drilling operational event taxonomy for PS 121.
 * Standardized categorization for drilling hazards, non-productive time (NPT),
 * formation dynamics, and well control occurrences.
 */
export const EventType = {
  MUD_LOSS: "MUD_LOSS",
  KICK: "KICK",
  STUCK_PIPE: "STUCK_PIPE",
  FISHING: "FISHING",
  TORQUE_SPIKE: "TORQUE_SPIKE",
  PRESSURE_SPIKE: "PRESSURE_SPIKE",
  OVERPRESSURE: "OVERPRESSURE",
  LOST_CIRCULATION: "LOST_CIRCULATION",
  CEMENTING_FAILURE: "CEMENTING_FAILURE",
  CASING_PROBLEM: "CASING_PROBLEM",
  NPT: "NPT",
  FORMATION_CHANGE: "FORMATION_CHANGE",
  WELL_CONTROL: "WELL_CONTROL",
} as const;

export type EventType = (typeof EventType)[keyof typeof EventType];

export const VALID_EVENT_TYPES: EventType[] = [
  EventType.MUD_LOSS,
  EventType.KICK,
  EventType.STUCK_PIPE,
  EventType.FISHING,
  EventType.TORQUE_SPIKE,
  EventType.PRESSURE_SPIKE,
  EventType.OVERPRESSURE,
  EventType.LOST_CIRCULATION,
  EventType.CEMENTING_FAILURE,
  EventType.CASING_PROBLEM,
  EventType.NPT,
  EventType.FORMATION_CHANGE,
  EventType.WELL_CONTROL,
];

/**
 * Operational event severity classification.
 */
export const EventSeverity = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;

export type EventSeverity = (typeof EventSeverity)[keyof typeof EventSeverity];

export const VALID_EVENT_SEVERITIES: EventSeverity[] = [
  EventSeverity.LOW,
  EventSeverity.MEDIUM,
  EventSeverity.HIGH,
  EventSeverity.CRITICAL,
];

/**
 * Human review workflow lifecycle state.
 */
export const ReviewStatus = {
  PENDING_REVIEW: "PENDING_REVIEW",
  APPROVED: "APPROVED",
  EDITED: "EDITED",
  INVALIDATED: "INVALIDATED",
} as const;

export type ReviewStatus = (typeof ReviewStatus)[keyof typeof ReviewStatus];

export const VALID_REVIEW_STATUSES: ReviewStatus[] = [
  ReviewStatus.PENDING_REVIEW,
  ReviewStatus.APPROVED,
  ReviewStatus.EDITED,
  ReviewStatus.INVALIDATED,
];

/**
 * Core DrillingEvent domain entity representing an operational event
 * extracted from historical technical drilling documentation.
 */
export interface DrillingEventEntity {
  id: string;
  wellId: string;
  eventType: EventType;
  depthMd: number;
  depthTvd: number | null;
  formation: string | null;
  severity: EventSeverity;
  description: string;
  cause: string | null;
  mitigation: string | null;
  outcome: string | null;
  sourceDocumentId: string;
  sourcePage: number;
  extractionConfidence: number;
  reviewStatus: ReviewStatus;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  nptHours?: number | null;
  sourceSection?: string | null;
  extractionModel?: string | null;
  evidence?: unknown;
  mlEventId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
