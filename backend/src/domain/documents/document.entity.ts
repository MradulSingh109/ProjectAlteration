/**
 * Historical drilling technical document classification.
 * Supported document types for PS 121:
 * - WCR: Well Completion Report
 * - DDR: Daily Drilling Report
 * - MUD_LOG: Mud Logging / Gas Chromatography Report
 * - CEMENTING_REPORT: Primary/Squeeze Cementing Evaluation Report
 * - WELL_SURVEY: Well Trajectory / Directional Gyro Survey
 */
export const DocumentType = {
  WCR: "WCR",
  DDR: "DDR",
  MUD_LOG: "MUD_LOG",
  CEMENTING_REPORT: "CEMENTING_REPORT",
  WELL_SURVEY: "WELL_SURVEY",
} as const;

export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

export const VALID_DOCUMENT_TYPES: DocumentType[] = [
  DocumentType.WCR,
  DocumentType.DDR,
  DocumentType.MUD_LOG,
  DocumentType.CEMENTING_REPORT,
  DocumentType.WELL_SURVEY,
];

/**
 * Asynchronous document ingestion lifecycle status.
 * All newly uploaded documents initially enter PENDING state.
 */
export const IngestionStatus = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;

export type IngestionStatus =
  (typeof IngestionStatus)[keyof typeof IngestionStatus];

/**
 * Core Document domain entity representing a historical drilling technical file.
 * Physical storage details and filesystem paths are intentionally excluded from client exposure.
 */
export interface DocumentEntity {
  id: string;
  wellId: string;
  filename: string;
  documentType: DocumentType;
  mimeType: string;
  fileSize: number;
  fileHash: string;
  storageKey: string;
  uploadedBy: string;
  uploadedAt: Date;
  ingestionStatus: IngestionStatus;
  createdAt: Date;
  updatedAt: Date;
}
