import {
  DrillingEventEntity,
  EventType,
  EventSeverity,
  ReviewStatus,
} from "./drilling-event.entity";

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
}

export interface ListDrillingEventsFilter {
  eventType?: EventType;
  severity?: EventSeverity;
  reviewStatus?: ReviewStatus;
}

export interface DrillingEventWithSource {
  event: DrillingEventEntity;
  sourceDocument: {
    id: string;
    filename: string;
    mimeType: string;
    documentType: string;
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
  ): Promise<DrillingEventEntity[]>;
  update(
    id: string,
    data: Partial<DrillingEventEntity>,
  ): Promise<DrillingEventEntity>;
  delete(id: string): Promise<void>;
}
