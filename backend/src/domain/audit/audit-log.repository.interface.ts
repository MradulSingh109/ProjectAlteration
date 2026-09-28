import { AuditLogEntity } from "./audit-log.entity";

export interface CreateAuditLogInput {
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  wellId?: string | null;
  details?: Record<string, unknown> | null;
}

export interface ListAuditLogsFilter {
  action?: string;
  resourceId?: string;
  wellId?: string;
  actorId?: string;
}

export interface IAuditLogRepository {
  create(input: CreateAuditLogInput): Promise<AuditLogEntity>;
  list(filter?: ListAuditLogsFilter): Promise<AuditLogEntity[]>;
  findById(id: string): Promise<AuditLogEntity | null>;
}
