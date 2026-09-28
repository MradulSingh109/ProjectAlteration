import { z } from "zod";
import {
  DocumentEntity,
  DocumentType,
  IngestionStatus,
  VALID_DOCUMENT_TYPES,
} from "@/domain/documents/document.entity";

/**
 * Zod schema for validating document type parameter.
 */
export const documentTypeSchema = z.enum(
  VALID_DOCUMENT_TYPES as [DocumentType, ...DocumentType[]],
  {
    message: `Invalid documentType. Must be one of: ${VALID_DOCUMENT_TYPES.join(", ")}`,
  },
);

/**
 * Safe client-facing response DTO for technical drilling documents.
 * SECURITY: NEVER exposes physical storage keys, directory roots, or server paths.
 */
export interface DocumentResponseDto {
  id: string;
  wellId: string;
  filename: string;
  documentType: DocumentType;
  mimeType: string;
  fileSize: number;
  fileHash: string;
  uploadedBy: string;
  uploadedAt: string;
  ingestionStatus: IngestionStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Maps a domain DocumentEntity to a secure, sanitized client-facing response DTO.
 */
export function toDocumentResponseDto(
  entity: DocumentEntity,
): DocumentResponseDto {
  return {
    id: entity.id,
    wellId: entity.wellId,
    filename: entity.filename,
    documentType: entity.documentType,
    mimeType: entity.mimeType,
    fileSize: entity.fileSize,
    fileHash: entity.fileHash,
    uploadedBy: entity.uploadedBy,
    uploadedAt: entity.uploadedAt.toISOString(),
    ingestionStatus: entity.ingestionStatus,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}
