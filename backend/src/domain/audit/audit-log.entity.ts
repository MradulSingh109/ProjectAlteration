/**
 * Supported domain actions requiring durable audit logging.
 */
export enum AuditAction {
  EVENT_CREATE = "EVENT_CREATE",
  EVENT_APPROVE = "EVENT_APPROVE",
  EVENT_EDIT = "EVENT_EDIT",
  EVENT_INVALIDATE = "EVENT_INVALIDATE",
  DOCUMENT_UPLOAD = "DOCUMENT_UPLOAD",
  DOCUMENT_RETRIEVE = "DOCUMENT_RETRIEVE",
  DOCUMENT_DELETE = "DOCUMENT_DELETE",
}

/**
 * Domain entity representing a persisted audit log record.
 */
export interface AuditLogEntity {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  wellId: string | null;
  details: Record<string, unknown> | null;
  createdAt: Date;
}
