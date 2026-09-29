import * as crypto from "crypto";
import {
  IDocumentRepository,
  ListDocumentsFilter,
} from "@/domain/documents/document.repository.interface";
import { documentRepository } from "@/infrastructure/documents/prisma-document.repository";
import { IWellRepository } from "@/domain/wells/well.repository.interface";
import { wellRepository } from "@/infrastructure/wells/prisma-well.repository";
import { IStorageService } from "@/domain/storage/storage.service.interface";
import { localStorageService } from "@/infrastructure/storage/local-storage.service";
import {
  DocumentEntity,
  DocumentType,
  IngestionStatus,
} from "@/domain/documents/document.entity";
import {
  DocumentResponseDto,
  documentTypeSchema,
  toDocumentResponseDto,
} from "./document.dto";
import { validatePdfDocument } from "@/infrastructure/documents/pdf-validator";
import { auditLogger } from "@/infrastructure/audit/audit.logger";
import { AppError } from "@/lib/errors";

export interface UploadDocumentParams {
  wellId: string;
  fileBuffer: Buffer;
  originalFilename: string;
  clientMimeType?: string;
  documentType: string;
  userId: string;
}

export interface RetrievedDocumentFile {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  fileSize: number;
}

/**
 * Application service orchestrating technical drilling document ingestion,
 * validation, storage, and secure retrieval.
 */
export class DocumentService {
  constructor(
    private readonly documentRepo: IDocumentRepository = documentRepository,
    private readonly wellRepo: IWellRepository = wellRepository,
    private readonly storage: IStorageService = localStorageService,
  ) {}

  /**
   * Securely validates, stores, and records a historical drilling document.
   *
   * Failure Compensation:
   * If physical storage succeeds but database persistence fails, the stored
   * binary is immediately purged to eliminate orphaned files.
   */
  async uploadDocument(
    params: UploadDocumentParams,
  ): Promise<DocumentResponseDto> {
    const {
      wellId,
      fileBuffer,
      originalFilename,
      clientMimeType,
      documentType,
      userId,
    } = params;

    // 1. Verify target well exists
    const well = await this.wellRepo.findById(wellId);
    if (!well) {
      throw AppError.notFound("Well not found");
    }

    // 2. Validate documentType parameter
    const parsedType = documentTypeSchema.safeParse(documentType);
    if (!parsedType.success) {
      throw AppError.validation(
        parsedType.error.issues[0]?.message || "Invalid documentType",
      );
    }
    const validatedType: DocumentType = parsedType.data;

    // 3. Cryptographically and structurally validate PDF document
    const validatedPdf = validatePdfDocument(
      fileBuffer,
      originalFilename,
      clientMimeType,
    );

    // 4. Duplicate Check: Ensure identical document content has not already been ingested for this well
    const duplicate = await this.documentRepo.findByWellAndHash(
      wellId,
      validatedPdf.fileHash,
    );
    if (duplicate) {
      throw AppError.conflict(
        "A document with identical content has already been uploaded for this well",
      );
    }

    // 5. Generate safe server-controlled storage key
    const documentId = crypto.randomUUID();
    const safeStorageKey = `documents/${wellId}/${documentId}.pdf`;

    // 6. Persist binary payload into storage abstraction
    await this.storage.put(
      safeStorageKey,
      validatedPdf.buffer,
      validatedPdf.mimeType,
    );

    // 7. Persist document metadata with explicit failure compensation
    try {
      const createdDocument = await this.documentRepo.create({
        id: documentId,
        wellId,
        filename: validatedPdf.filename,
        documentType: validatedType,
        mimeType: validatedPdf.mimeType,
        fileSize: validatedPdf.fileSize,
        fileHash: validatedPdf.fileHash,
        storageKey: safeStorageKey,
        uploadedBy: userId,
        ingestionStatus: IngestionStatus.PENDING,
      });

      // 8. Audit event emission
      auditLogger.log({
        action: "DOCUMENT_UPLOAD",
        actorId: userId,
        resourceId: createdDocument.id,
        wellId,
        details: {
          filename: createdDocument.filename,
          documentType: createdDocument.documentType,
          fileSize: createdDocument.fileSize,
          fileHash: createdDocument.fileHash,
        },
      });

      return toDocumentResponseDto(createdDocument);
    } catch (dbError) {
      // Rollback/compensation: remove physical file to prevent orphaned storage
      try {
        await this.storage.delete(safeStorageKey);
      } catch (cleanupError) {
        console.error(
          `[CRITICAL] Failed to compensate physical file cleanup for key: ${safeStorageKey}`,
          cleanupError,
        );
      }
      throw dbError;
    }
  }

  /**
   * Retrieves all document metadata records for a given well.
   */
  async listDocumentsByWell(
    wellId: string,
    filter?: ListDocumentsFilter,
  ): Promise<DocumentResponseDto[]> {
    // Verify well exists
    const well = await this.wellRepo.findById(wellId);
    if (!well) {
      throw AppError.notFound("Well not found");
    }

    const docs = await this.documentRepo.listByWellId(wellId, filter);
    return docs.map(toDocumentResponseDto);
  }

  /**
   * Retrieves document metadata by document ID.
   */
  async getDocumentMetadata(
    documentId: string,
    actorId?: string,
  ): Promise<DocumentResponseDto> {
    const doc = await this.documentRepo.findById(documentId);
    if (!doc) {
      throw AppError.notFound("Document not found");
    }

    auditLogger.log({
      action: "DOCUMENT_METADATA_READ",
      actorId,
      resourceId: doc.id,
      wellId: doc.wellId,
    });

    return toDocumentResponseDto(doc);
  }

  /**
   * Retrieves the raw PDF binary for a document by document ID.
   * Access is routed entirely through storage abstraction; physical paths are never leaked.
   */
  async getDocumentFile(
    documentId: string,
    actorId?: string,
  ): Promise<RetrievedDocumentFile> {
    const doc = await this.documentRepo.findById(documentId);
    if (!doc) {
      throw AppError.notFound("Document not found");
    }

    const buffer = await this.storage.get(doc.storageKey);
    if (!buffer) {
      throw AppError.internal(
        "Document storage object is missing or unreadable",
      );
    }

    auditLogger.log({
      action: "DOCUMENT_RETRIEVE",
      actorId,
      resourceId: doc.id,
      wellId: doc.wellId,
      details: {
        filename: doc.filename,
        fileSize: doc.fileSize,
      },
    });

    return {
      buffer,
      filename: doc.filename,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
    };
  }
}

export const documentService = new DocumentService();
