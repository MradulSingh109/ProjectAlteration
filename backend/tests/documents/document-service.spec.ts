import { describe, it, expect, beforeEach, vi } from "vitest";
import { DocumentService } from "@/application/documents/document.service";
import { IDocumentRepository } from "@/domain/documents/document.repository.interface";
import { IWellRepository } from "@/domain/wells/well.repository.interface";
import { IStorageService } from "@/domain/storage/storage.service.interface";
import {
  DocumentEntity,
  DocumentType,
  IngestionStatus,
} from "@/domain/documents/document.entity";
import { queryDocumentsSchema } from "@/application/documents/document.dto";
import { WellEntity } from "@/domain/wells/well.entity";

describe("DocumentService Application Logic & Compensation", () => {
  let service: DocumentService;
  let mockDocRepo: IDocumentRepository;
  let mockWellRepo: IWellRepository;
  let mockStorage: IStorageService;

  const validPdfBuffer = Buffer.from("%PDF-1.4\nSample Technical Report Data");
  const testWell: WellEntity = {
    id: "well-uuid-1",
    wellId: "MH-01",
    name: "Mumbai High 01",
    field: "Mumbai High",
    latitude: 19.4,
    longitude: 71.3,
    plannedDepthMd: 3500,
    plannedDepthTvd: 3200,
    spudDate: new Date(),
    status: "DRILLING",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockDocRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      findByWellAndHash: vi.fn(),
      listByWellId: vi.fn(),
      delete: vi.fn(),
    };

    mockWellRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      findByWellId: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
      findNearby: vi.fn(),
    };

    mockStorage = {
      put: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
      exists: vi.fn(),
    };

    service = new DocumentService(mockDocRepo, mockWellRepo, mockStorage);
  });

  it("successfully uploads a document with initial PENDING status and sanitized DTO", async () => {
    vi.mocked(mockWellRepo.findById).mockResolvedValue(testWell);
    vi.mocked(mockDocRepo.findByWellAndHash).mockResolvedValue(null);

    const createdEntity: DocumentEntity = {
      id: "doc-uuid-1",
      wellId: testWell.id,
      filename: "daily_drilling_report.pdf",
      documentType: DocumentType.DDR,
      mimeType: "application/pdf",
      fileSize: validPdfBuffer.length,
      fileHash: "fakehash123",
      storageKey: `documents/${testWell.id}/doc-uuid-1.pdf`,
      uploadedBy: "user-uuid-1",
      uploadedAt: new Date(),
      ingestionStatus: IngestionStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(mockDocRepo.create).mockResolvedValue(createdEntity);

    const result = await service.uploadDocument({
      wellId: testWell.id,
      fileBuffer: validPdfBuffer,
      originalFilename: "daily_drilling_report.pdf",
      clientMimeType: "application/pdf",
      documentType: "DDR",
      userId: "user-uuid-1",
    });

    expect(result.id).toBe("doc-uuid-1");
    expect(result.ingestionStatus).toBe(IngestionStatus.PENDING);
    expect(result.documentType).toBe(DocumentType.DDR);
    expect(result.filename).toBe("daily_drilling_report.pdf");
    // Crucial security requirement: physical storageKey is NOT exposed in response DTO
    expect((result as any).storageKey).toBeUndefined();

    expect(mockStorage.put).toHaveBeenCalledWith(
      expect.stringMatching(/^documents\/well-uuid-1\/[a-f0-9-]+\.pdf$/),
      validPdfBuffer,
      "application/pdf",
    );
    expect(mockDocRepo.create).toHaveBeenCalled();
  });

  it("throws 404 NOT_FOUND when uploading to a non-existent well", async () => {
    vi.mocked(mockWellRepo.findById).mockResolvedValue(null);

    await expect(
      service.uploadDocument({
        wellId: "non-existent-well",
        fileBuffer: validPdfBuffer,
        originalFilename: "report.pdf",
        documentType: "WCR",
        userId: "user-1",
      }),
    ).rejects.toThrow(/Well not found/i);

    expect(mockStorage.put).not.toHaveBeenCalled();
    expect(mockDocRepo.create).not.toHaveBeenCalled();
  });

  it("throws 400 VALIDATION_ERROR when documentType is invalid", async () => {
    vi.mocked(mockWellRepo.findById).mockResolvedValue(testWell);

    await expect(
      service.uploadDocument({
        wellId: testWell.id,
        fileBuffer: validPdfBuffer,
        originalFilename: "report.pdf",
        documentType: "INVALID_REPORT_TYPE",
        userId: "user-1",
      }),
    ).rejects.toThrow(/Invalid documentType/i);

    expect(mockStorage.put).not.toHaveBeenCalled();
  });

  it("throws 409 CONFLICT when a document with identical hash already exists for the well", async () => {
    vi.mocked(mockWellRepo.findById).mockResolvedValue(testWell);

    const existingDoc: DocumentEntity = {
      id: "doc-uuid-existing",
      wellId: testWell.id,
      filename: "existing.pdf",
      documentType: DocumentType.WCR,
      mimeType: "application/pdf",
      fileSize: validPdfBuffer.length,
      fileHash: "matching-hash",
      storageKey: "documents/well/existing.pdf",
      uploadedBy: "user-1",
      uploadedAt: new Date(),
      ingestionStatus: IngestionStatus.COMPLETED,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(mockDocRepo.findByWellAndHash).mockResolvedValue(existingDoc);

    await expect(
      service.uploadDocument({
        wellId: testWell.id,
        fileBuffer: validPdfBuffer,
        originalFilename: "report.pdf",
        documentType: "WCR",
        userId: "user-1",
      }),
    ).rejects.toThrow(/identical content has already been uploaded/i);

    expect(mockStorage.put).not.toHaveBeenCalled();
    expect(mockDocRepo.create).not.toHaveBeenCalled();
  });

  it("compensates by purging stored physical file if database persistence fails", async () => {
    vi.mocked(mockWellRepo.findById).mockResolvedValue(testWell);
    vi.mocked(mockDocRepo.findByWellAndHash).mockResolvedValue(null);
    vi.mocked(mockStorage.put).mockResolvedValue(undefined);

    // Database failure occurs after storage write
    vi.mocked(mockDocRepo.create).mockRejectedValue(
      new Error("PostgreSQL connection lost"),
    );

    await expect(
      service.uploadDocument({
        wellId: testWell.id,
        fileBuffer: validPdfBuffer,
        originalFilename: "report.pdf",
        documentType: "MUD_LOG",
        userId: "user-1",
      }),
    ).rejects.toThrow(/PostgreSQL connection lost/i);

    // Verify storage compensation deleted the stored file
    expect(mockStorage.delete).toHaveBeenCalledTimes(1);
    expect(mockStorage.delete).toHaveBeenCalledWith(
      expect.stringMatching(/^documents\/well-uuid-1\/[a-f0-9-]+\.pdf$/),
    );
  });

  it("retrieves document metadata and ensures no storage path leakage", async () => {
    const existingDoc: DocumentEntity = {
      id: "doc-123",
      wellId: testWell.id,
      filename: "trajectory_survey.pdf",
      documentType: DocumentType.WELL_SURVEY,
      mimeType: "application/pdf",
      fileSize: 45000,
      fileHash: "hash123",
      storageKey: "documents/well-1/doc-123.pdf",
      uploadedBy: "engineer-1",
      uploadedAt: new Date(),
      ingestionStatus: IngestionStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(mockDocRepo.findById).mockResolvedValue(existingDoc);

    const result = await service.getDocumentMetadata("doc-123");
    expect(result.id).toBe("doc-123");
    expect(result.filename).toBe("trajectory_survey.pdf");
    expect((result as any).storageKey).toBeUndefined();
  });

  it("throws 404 when document metadata is requested for non-existent document", async () => {
    vi.mocked(mockDocRepo.findById).mockResolvedValue(null);

    await expect(
      service.getDocumentMetadata("non-existent-doc"),
    ).rejects.toThrow(/Document not found/i);
  });

  it("retrieves document binary payload through storage abstraction", async () => {
    const existingDoc: DocumentEntity = {
      id: "doc-123",
      wellId: testWell.id,
      filename: "trajectory_survey.pdf",
      documentType: DocumentType.WELL_SURVEY,
      mimeType: "application/pdf",
      fileSize: validPdfBuffer.length,
      fileHash: "hash123",
      storageKey: "documents/well-1/doc-123.pdf",
      uploadedBy: "engineer-1",
      uploadedAt: new Date(),
      ingestionStatus: IngestionStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(mockDocRepo.findById).mockResolvedValue(existingDoc);
    vi.mocked(mockStorage.get).mockResolvedValue(validPdfBuffer);

    const result = await service.getDocumentFile("doc-123");
    expect(result.filename).toBe("trajectory_survey.pdf");
    expect(result.buffer).toBe(validPdfBuffer);
    expect(result.mimeType).toBe("application/pdf");
    expect(mockStorage.get).toHaveBeenCalledWith(
      "documents/well-1/doc-123.pdf",
    );
  });

  it("throws 500 INTERNAL_ERROR if document metadata exists but storage binary is missing", async () => {
    const existingDoc: DocumentEntity = {
      id: "doc-123",
      wellId: testWell.id,
      filename: "missing_file.pdf",
      documentType: DocumentType.WELL_SURVEY,
      mimeType: "application/pdf",
      fileSize: 1000,
      fileHash: "hash123",
      storageKey: "documents/well-1/doc-123.pdf",
      uploadedBy: "engineer-1",
      uploadedAt: new Date(),
      ingestionStatus: IngestionStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(mockDocRepo.findById).mockResolvedValue(existingDoc);
    vi.mocked(mockStorage.get).mockResolvedValue(null); // Storage object missing!

    await expect(service.getDocumentFile("doc-123")).rejects.toThrow(
      /Document storage object is missing or unreadable/i,
    );
  });

  describe("queryDocumentsSchema Validation", () => {
    it("validates valid document query parameters", () => {
      const parsed = queryDocumentsSchema.parse({
        documentType: "DDR",
        ingestionStatus: "COMPLETED",
      });
      expect(parsed.documentType).toBe("DDR");
      expect(parsed.ingestionStatus).toBe("COMPLETED");
    });

    it("accepts empty query and leaves optional filters undefined", () => {
      const parsed = queryDocumentsSchema.parse({});
      expect(parsed.documentType).toBeUndefined();
      expect(parsed.ingestionStatus).toBeUndefined();
    });

    it("rejects invalid documentType", () => {
      expect(() =>
        queryDocumentsSchema.parse({
          documentType: "INVALID_TYPE",
        }),
      ).toThrow(/Invalid documentType/);
    });

    it("rejects invalid ingestionStatus", () => {
      expect(() =>
        queryDocumentsSchema.parse({
          ingestionStatus: "UNKNOWN_STATUS",
        }),
      ).toThrow(/Invalid ingestionStatus/);
    });
  });
});
