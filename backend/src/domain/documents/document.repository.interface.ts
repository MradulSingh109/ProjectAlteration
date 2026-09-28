import {
  DocumentEntity,
  DocumentType,
  IngestionStatus,
} from "./document.entity";

export interface CreateDocumentInput {
  id?: string;
  wellId: string;
  filename: string;
  documentType: DocumentType;
  mimeType: string;
  fileSize: number;
  fileHash: string;
  storageKey: string;
  uploadedBy: string;
  ingestionStatus?: IngestionStatus;
}

export interface ListDocumentsFilter {
  documentType?: DocumentType;
  ingestionStatus?: IngestionStatus;
}

/**
 * Repository port abstraction for Document persistence.
 * Isolates domain and application layers from specific ORM and database implementations.
 */
export interface IDocumentRepository {
  create(data: CreateDocumentInput): Promise<DocumentEntity>;
  findById(id: string): Promise<DocumentEntity | null>;
  findByWellAndHash(
    wellId: string,
    fileHash: string,
  ): Promise<DocumentEntity | null>;
  listByWellId(
    wellId: string,
    filter?: ListDocumentsFilter,
  ): Promise<DocumentEntity[]>;
  delete(id: string): Promise<void>;
}
