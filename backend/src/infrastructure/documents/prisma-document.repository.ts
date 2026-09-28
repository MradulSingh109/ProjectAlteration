import { prisma } from "@/infrastructure/database/prisma";
import {
  IDocumentRepository,
  CreateDocumentInput,
  ListDocumentsFilter,
} from "@/domain/documents/document.repository.interface";
import {
  DocumentEntity,
  DocumentType,
  IngestionStatus,
} from "@/domain/documents/document.entity";
import { PrismaClient } from "@prisma/client";
import { AppError } from "@/lib/errors";

function mapDocument(row: any): DocumentEntity {
  return {
    id: row.id,
    wellId: row.wellId,
    filename: row.filename,
    documentType: row.documentType as DocumentType,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    fileHash: row.fileHash,
    storageKey: row.storageKey,
    uploadedBy: row.uploadedBy,
    uploadedAt: row.uploadedAt,
    ingestionStatus: row.ingestionStatus as IngestionStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaDocumentRepository implements IDocumentRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async create(data: CreateDocumentInput): Promise<DocumentEntity> {
    try {
      const doc = await this.db.document.create({
        data: {
          ...(data.id ? { id: data.id } : {}),
          wellId: data.wellId,
          filename: data.filename,
          documentType: data.documentType,
          mimeType: data.mimeType,
          fileSize: data.fileSize,
          fileHash: data.fileHash,
          storageKey: data.storageKey,
          uploadedBy: data.uploadedBy,
          ingestionStatus: data.ingestionStatus || IngestionStatus.PENDING,
        },
      });
      return mapDocument(doc);
    } catch (error: any) {
      // Intercept PostgreSQL unique constraint violation (P2002) for (well_id, file_hash)
      if (error && error.code === "P2002") {
        throw AppError.conflict(
          "Document with identical content has already been uploaded for this well",
        );
      }
      throw error;
    }
  }

  async findById(id: string): Promise<DocumentEntity | null> {
    const doc = await this.db.document.findUnique({
      where: { id },
    });
    return doc ? mapDocument(doc) : null;
  }

  async findByWellAndHash(
    wellId: string,
    fileHash: string,
  ): Promise<DocumentEntity | null> {
    const doc = await this.db.document.findUnique({
      where: {
        wellId_fileHash: {
          wellId,
          fileHash,
        },
      },
    });
    return doc ? mapDocument(doc) : null;
  }

  async listByWellId(
    wellId: string,
    filter?: ListDocumentsFilter,
  ): Promise<DocumentEntity[]> {
    const docs = await this.db.document.findMany({
      where: {
        wellId,
        ...(filter?.documentType ? { documentType: filter.documentType } : {}),
        ...(filter?.ingestionStatus
          ? { ingestionStatus: filter.ingestionStatus }
          : {}),
      },
      orderBy: { uploadedAt: "desc" },
    });
    return docs.map(mapDocument);
  }

  async delete(id: string): Promise<void> {
    try {
      await this.db.document.delete({
        where: { id },
      });
    } catch (error: any) {
      if (error && error.code === "P2025") {
        return; // Idempotent: record already gone
      }
      throw error;
    }
  }
}

export const documentRepository = new PrismaDocumentRepository();
