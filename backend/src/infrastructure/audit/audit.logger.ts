/**
 * Lightweight, structured audit logger for NWIS security-sensitive operations.
 *
 * Security Requirements:
 * - Records action, actor ID, target resource, and metadata.
 * - NEVER records passwords, secrets, JWT tokens, or raw document binary contents.
 */
export interface AuditLogEntry {
  action:
    | "DOCUMENT_UPLOAD"
    | "DOCUMENT_RETRIEVE"
    | "DOCUMENT_METADATA_READ"
    | "DOCUMENT_DELETE"
    | "AUTHORIZATION_FAILURE"
    | "EVENT_CREATE"
    | "EVENT_APPROVE"
    | "EVENT_EDIT"
    | "EVENT_INVALIDATE";
  actorId?: string;
  actorRole?: string;
  resourceId?: string;
  wellId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  timestamp?: string;
}

export class AuditLogger {
  log(entry: AuditLogEntry): void {
    const timestamp = entry.timestamp || new Date().toISOString();
    const detailsStr = entry.details ? JSON.stringify(entry.details) : "{}";

    // In production, this can route to stdout or a structured log aggregator
    console.info(
      `[AUDIT] [${timestamp}] action=${entry.action} actor=${entry.actorId ?? "anonymous"} role=${entry.actorRole ?? "none"} resource=${entry.resourceId ?? "none"} well=${entry.wellId ?? "none"} details=${detailsStr}`,
    );
  }
}

export const auditLogger = new AuditLogger();
