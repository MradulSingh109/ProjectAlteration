import {
  DrillingEventEntity,
  EventType,
  EventSeverity,
  ReviewStatus,
} from "./drilling-event.entity";

export type EventSortField =
  | "depthMd"
  | "depthTvd"
  | "severity"
  | "eventType"
  | "reviewStatus"
  | "extractionConfidence"
  | "createdAt"
  | "sourcePage";

export type SortOrder = "asc" | "desc";

export interface CreateDrillingEventInput {
  id?: string;
  wellId: string;
  eventType: EventType;
  depthMd: number;
  depthTvd?: number | null;
  formation?: string | null;
  severity: EventSeverity;
  description: string;
  cause?: string | null;
  mitigation?: string | null;
  outcome?: string | null;
  sourceDocumentId: string;
  sourcePage: number;
  extractionConfidence: number;
  reviewStatus?: ReviewStatus;
  reviewedBy?: string | null;
  reviewedAt?: Date | null;
  nptHours?: number | null;
  sourceSection?: string | null;
  extractionModel?: string | null;
  evidence?: unknown;
  mlEventId?: string | null;
}

export interface ListDrillingEventsFilter {
  eventType?: EventType;
  severity?: EventSeverity;
  reviewStatus?: ReviewStatus;
  formation?: string;
  minDepthMd?: number;
  maxDepthMd?: number;
  minDepthTvd?: number;
  maxDepthTvd?: number;
  minConfidence?: number;
  maxConfidence?: number;
  sourceDocumentId?: string;
  page?: number;
  pageSize?: number;
  sortBy?: EventSortField;
  sortOrder?: SortOrder;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface WellEventSummary {
  wellId: string;
  totalEvents: number;
  byEventType: Record<string, number>;
  bySeverity: Record<string, number>;
  byReviewStatus: Record<string, number>;
  byFormation: Record<string, number>;
}

export interface DrillingEventWithSource {
  event: DrillingEventEntity;
  well?: {
    id: string;
    wellId: string;
    name: string;
    field: string;
  };
  sourceDocument: {
    id: string;
    filename: string;
    mimeType: string;
    documentType: string;
    fileSize?: number;
    fileHash?: string;
    uploadedAt?: Date;
    ingestionStatus?: string;
  };
}

/**
 * Repository port abstraction for DrillingEvent persistence.
 */
export interface IDrillingEventRepository {
  create(data: CreateDrillingEventInput): Promise<DrillingEventEntity>;
  findById(id: string): Promise<DrillingEventEntity | null>;
  findByIdWithSource(id: string): Promise<DrillingEventWithSource | null>;
  listByWellId(
    wellId: string,
    filter?: ListDrillingEventsFilter,
  ): Promise<PaginatedResult<DrillingEventEntity>>;
  listByDocumentId(
    documentId: string,
    filter?: ListDrillingEventsFilter,
  ): Promise<PaginatedResult<DrillingEventEntity>>;
  getSummaryByWellId(wellId: string): Promise<WellEventSummary>;
  update(
    id: string,
    data: Partial<DrillingEventEntity>,
  ): Promise<DrillingEventEntity>;
  delete(id: string): Promise<void>;
}
