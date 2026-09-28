import { describe, it, expect, beforeEach, vi } from "vitest";
import { DrillingEventService } from "@/application/events/drilling-event.service";
import {
  IDrillingEventRepository,
  ListDrillingEventsFilter,
} from "@/domain/events/drilling-event.repository.interface";
import { IWellRepository } from "@/domain/wells/well.repository.interface";
import { IDocumentRepository } from "@/domain/documents/document.repository.interface";
import { IAuditLogRepository } from "@/domain/audit/audit-log.repository.interface";
import {
  DrillingEventEntity,
  EventType,
  EventSeverity,
  ReviewStatus,
} from "@/domain/events/drilling-event.entity";
import { WellEntity } from "@/domain/wells/well.entity";
import {
  DocumentEntity,
  DocumentType,
  IngestionStatus,
} from "@/domain/documents/document.entity";

describe("Step 8 — Advanced Drilling Event, Document Provenance & Query APIs", () => {
  let service: DrillingEventService;
  let mockEventRepo: IDrillingEventRepository;
  let mockWellRepo: IWellRepository;
  let mockDocRepo: IDocumentRepository;
  let mockAuditLogRepo: IAuditLogRepository;

  const testWell: WellEntity = {
    id: "well-uuid-1",
    wellId: "MH-01",
    name: "Mumbai High 01",
    field: "Mumbai High",
    latitude: 19.4,
    longitude: 71.3,
    plannedDepthMd: 3500.125,
    plannedDepthTvd: 3200.5,
    spudDate: new Date(),
    status: "DRILLING",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const testDocument: DocumentEntity = {
    id: "doc-uuid-1",
    wellId: testWell.id,
    filename: "daily_drilling_report_05.pdf",
    documentType: DocumentType.DDR,
    mimeType: "application/pdf",
    fileSize: 50000,
    fileHash: "sha256_mock_hash",
    storageKey: `documents/${testWell.id}/doc-uuid-1.pdf`,
    uploadedBy: "user-eng-1",
    uploadedAt: new Date(),
    ingestionStatus: IngestionStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleEvent1: DrillingEventEntity = {
    id: "event-uuid-1",
    wellId: testWell.id,
    eventType: EventType.MUD_LOSS,
    depthMd: 2450.125,
    depthTvd: 2200.5,
    formation: "Bassein Limestone",
    severity: EventSeverity.HIGH,
    description: "Partial mud loss of 35 bbl/hr observed",
    cause: "High-permeability vuggy zone",
    mitigation: "Spotted LCM pill",
    outcome: "Losses arrested",
    sourceDocumentId: testDocument.id,
    sourcePage: 14,
    extractionConfidence: 0.92,
    reviewStatus: ReviewStatus.APPROVED,
    reviewedBy: "reviewer-1",
    reviewedAt: new Date(),
    createdAt: new Date("2026-09-28T10:00:00Z"),
    updatedAt: new Date("2026-09-28T10:00:00Z"),
  };

  const sampleEvent2: DrillingEventEntity = {
    id: "event-uuid-2",
    wellId: testWell.id,
    eventType: EventType.KICK,
    depthMd: 2800.0,
    depthTvd: 2500.0,
    formation: "Mukta Formation",
    severity: EventSeverity.CRITICAL,
    description: "Gas influx detected",
    cause: "Overpressure zone",
    mitigation: "Circulated kill mud",
    outcome: "Well killed",
    sourceDocumentId: testDocument.id,
    sourcePage: 18,
    extractionConfidence: 0.96,
    reviewStatus: ReviewStatus.PENDING_REVIEW,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date("2026-09-28T12:00:00Z"),
    updatedAt: new Date("2026-09-28T12:00:00Z"),
  };

  beforeEach(() => {
    mockEventRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      findByIdWithSource: vi.fn(),
      listByWellId: vi
        .fn()
        .mockImplementation((_wellId, filter?: ListDrillingEventsFilter) => {
          const events = [sampleEvent1, sampleEvent2];
          const page = filter?.page ?? 1;
          const pageSize = filter?.pageSize ?? 20;
          return Promise.resolve(
            Object.assign([...events], {
              items: events,
              pagination: {
                page,
                pageSize,
                totalItems: events.length,
                totalPages: 1,
              },
            }),
          );
        }),
      listByDocumentId: vi
        .fn()
        .mockImplementation((_docId, filter?: ListDrillingEventsFilter) => {
          const events = [sampleEvent1, sampleEvent2];
          const page = filter?.page ?? 1;
          const pageSize = filter?.pageSize ?? 20;
          return Promise.resolve(
            Object.assign([...events], {
              items: events,
              pagination: {
                page,
                pageSize,
                totalItems: events.length,
                totalPages: 1,
              },
            }),
          );
        }),
      getSummaryByWellId: vi.fn().mockResolvedValue({
        wellId: testWell.id,
        totalEvents: 2,
        byEventType: { MUD_LOSS: 1, KICK: 1 },
        bySeverity: { HIGH: 1, CRITICAL: 1 },
        byReviewStatus: { APPROVED: 1, PENDING_REVIEW: 1 },
        byFormation: { "Bassein Limestone": 1, "Mukta Formation": 1 },
      }),
      update: vi.fn(),
      delete: vi.fn(),
    };

    mockWellRepo = {
      create: vi.fn(),
      findById: vi.fn().mockResolvedValue(testWell),
      findByWellId: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
      findNearby: vi.fn(),
    };

    mockDocRepo = {
      create: vi.fn(),
      findById: vi.fn().mockResolvedValue(testDocument),
      findByWellAndHash: vi.fn(),
      listByWellId: vi.fn(),
      delete: vi.fn(),
    };

    mockAuditLogRepo = {
      create: vi.fn(),
      list: vi.fn(),
      findById: vi.fn(),
    };

    service = new DrillingEventService(
      mockEventRepo,
      mockWellRepo,
      mockDocRepo,
      mockAuditLogRepo,
    );
  });

  describe("Phase 2 & 4 — Filter Validation & Query Processing", () => {
    it("lists events with valid filter parameters", async () => {
      const result = await service.listEventsByWell(testWell.id, {
        eventType: "MUD_LOSS",
        severity: "HIGH",
        reviewStatus: "APPROVED",
        formation: "Bassein",
        minDepthMd: 2000,
        maxDepthMd: 3000,
        minConfidence: 0.8,
        maxConfidence: 1.0,
        page: 1,
        pageSize: 10,
        sortBy: "depthMd",
        sortOrder: "asc",
      });

      expect(result.items).toHaveLength(2);
      expect(result.pagination).toEqual({
        page: 1,
        pageSize: 10,
        totalItems: 2,
        totalPages: 1,
      });
      expect(mockEventRepo.listByWellId).toHaveBeenCalledWith(
        testWell.id,
        expect.objectContaining({
          eventType: "MUD_LOSS",
          severity: "HIGH",
          reviewStatus: "APPROVED",
          formation: "Bassein",
          minDepthMd: 2000,
          maxDepthMd: 3000,
          minConfidence: 0.8,
          maxConfidence: 1.0,
          page: 1,
          pageSize: 10,
          sortBy: "depthMd",
          sortOrder: "asc",
        }),
      );
    });

    it("rejects minDepthMd greater than maxDepthMd (400 VALIDATION_ERROR)", async () => {
      await expect(
        service.listEventsByWell(testWell.id, {
          minDepthMd: 3500,
          maxDepthMd: 2000, // Invalid! min > max
        }),
      ).rejects.toThrow(/minDepthMd cannot be greater than maxDepthMd/i);
    });

    it("rejects minDepthTvd greater than maxDepthTvd (400 VALIDATION_ERROR)", async () => {
      await expect(
        service.listEventsByWell(testWell.id, {
          minDepthTvd: 3200,
          maxDepthTvd: 2500, // Invalid! min > max
        }),
      ).rejects.toThrow(/minDepthTvd cannot be greater than maxDepthTvd/i);
    });

    it("rejects minConfidence greater than maxConfidence (400 VALIDATION_ERROR)", async () => {
      await expect(
        service.listEventsByWell(testWell.id, {
          minConfidence: 0.9,
          maxConfidence: 0.5, // Invalid! min > max
        }),
      ).rejects.toThrow(/minConfidence cannot be greater than maxConfidence/i);
    });

    it("rejects invalid eventType enum value", async () => {
      await expect(
        service.listEventsByWell(testWell.id, {
          eventType: "NON_EXISTENT_HAZARD",
        }),
      ).rejects.toThrow(/Invalid eventType/i);
    });

    it("rejects invalid severity enum value", async () => {
      await expect(
        service.listEventsByWell(testWell.id, {
          severity: "EXTREME_DANGER",
        }),
      ).rejects.toThrow(/Invalid severity/i);
    });

    it("rejects invalid reviewStatus enum value", async () => {
      await expect(
        service.listEventsByWell(testWell.id, {
          reviewStatus: "IN_LIMBO",
        }),
      ).rejects.toThrow(/Invalid reviewStatus/i);
    });

    it("rejects negative depth values in query filters", async () => {
      await expect(
        service.listEventsByWell(testWell.id, {
          minDepthMd: -50,
        }),
      ).rejects.toThrow(/Depth cannot be negative/i);
    });

    it("rejects confidence values strictly outside 0..1", async () => {
      await expect(
        service.listEventsByWell(testWell.id, {
          minConfidence: -0.1,
        }),
      ).rejects.toThrow(/minConfidence must be between 0.0 and 1.0/i);

      await expect(
        service.listEventsByWell(testWell.id, {
          maxConfidence: 1.5,
        }),
      ).rejects.toThrow(/maxConfidence must be between 0.0 and 1.0/i);
    });
  });

  describe("Phase 3 & 5 — Pagination & Sorting", () => {
    it("rejects page numbers less than 1 (0 or negative)", async () => {
      await expect(
        service.listEventsByWell(testWell.id, {
          page: 0,
        }),
      ).rejects.toThrow(/Page must be greater than or equal to 1/i);
    });

    it("rejects pageSize greater than strict maximum of 100", async () => {
      await expect(
        service.listEventsByWell(testWell.id, {
          pageSize: 500,
        }),
      ).rejects.toThrow(/PageSize cannot exceed 100/i);
    });

    it("rejects arbitrary or unsafe sortBy fields (allowlist enforcement)", async () => {
      await expect(
        service.listEventsByWell(testWell.id, {
          sortBy: "password_hash", // Arbitrary/injected column
        }),
      ).rejects.toThrow(/Invalid sortBy field/i);
    });

    it("rejects invalid sortOrder", async () => {
      await expect(
        service.listEventsByWell(testWell.id, {
          sortOrder: "sideways",
        }),
      ).rejects.toThrow(/sortOrder must be either 'asc' or 'desc'/i);
    });

    it("uses sensible defaults: page=1, pageSize=20, sortBy=createdAt, sortOrder=desc", async () => {
      await service.listEventsByWell(testWell.id, {});

      expect(mockEventRepo.listByWellId).toHaveBeenCalledWith(
        testWell.id,
        expect.objectContaining({
          page: 1,
          pageSize: 20,
          sortBy: "createdAt",
          sortOrder: "desc",
        }),
      );
    });
  });

  describe("Phase 6 & 7 — Document Provenance & Event Detail", () => {
    it("returns detailed event with safe well reference and source document provenance", async () => {
      vi.mocked(mockEventRepo.findByIdWithSource).mockResolvedValue({
        event: sampleEvent1,
        well: {
          id: testWell.id,
          wellId: testWell.wellId,
          name: testWell.name,
          field: testWell.field,
        },
        sourceDocument: {
          id: testDocument.id,
          filename: testDocument.filename,
          mimeType: testDocument.mimeType,
          documentType: testDocument.documentType,
          fileSize: testDocument.fileSize,
          fileHash: testDocument.fileHash,
          uploadedAt: testDocument.uploadedAt,
          ingestionStatus: testDocument.ingestionStatus,
        },
      });

      const detail = await service.getEventDetail(sampleEvent1.id);

      expect(detail.id).toBe(sampleEvent1.id);
      expect(detail.well).toEqual({
        id: testWell.id,
        wellId: testWell.wellId,
        name: testWell.name,
        field: testWell.field,
      });
      expect(detail.sourceDocument).toEqual({
        id: testDocument.id,
        filename: testDocument.filename,
        mimeType: testDocument.mimeType,
        documentType: testDocument.documentType,
        fileSize: testDocument.fileSize,
        fileHash: testDocument.fileHash,
        uploadedAt: testDocument.uploadedAt.toISOString(),
        ingestionStatus: testDocument.ingestionStatus,
      });

      // STRICT SECURITY CHECK: No internal storage paths or storageKey
      const serialized = JSON.stringify(detail);
      expect(serialized).not.toContain("storageKey");
      expect(serialized).not.toContain("documents/");
    });

    it("throws 404 NOT_FOUND when event detail is requested for nonexistent event", async () => {
      vi.mocked(mockEventRepo.findByIdWithSource).mockResolvedValue(null);

      await expect(
        service.getEventDetail("missing-event-uuid"),
      ).rejects.toThrow(/Drilling event not found/i);
    });
  });

  describe("Phase 8 — Document -> Events Query API", () => {
    it("returns paginated events originating from a verified document", async () => {
      const result = await service.listEventsByDocument(testDocument.id, {
        page: 1,
        pageSize: 10,
        eventType: "MUD_LOSS",
      });

      expect(result.items).toHaveLength(2);
      expect(result.pagination.totalItems).toBe(2);
      expect(mockDocRepo.findById).toHaveBeenCalledWith(testDocument.id);
      expect(mockEventRepo.listByDocumentId).toHaveBeenCalledWith(
        testDocument.id,
        expect.objectContaining({
          page: 1,
          pageSize: 10,
          eventType: "MUD_LOSS",
        }),
      );
    });

    it("throws 404 NOT_FOUND when querying events for nonexistent document", async () => {
      vi.mocked(mockDocRepo.findById).mockResolvedValue(null);

      await expect(
        service.listEventsByDocument("non-existent-doc-id"),
      ).rejects.toThrow(/Document not found/i);
    });
  });

  describe("Phase 9 — Well Event Summary API", () => {
    it("computes database-derived aggregation summary for a verified well", async () => {
      const summary = await service.getWellEventSummary(testWell.id);

      expect(summary).toEqual({
        wellId: testWell.id,
        totalEvents: 2,
        byEventType: { MUD_LOSS: 1, KICK: 1 },
        bySeverity: { HIGH: 1, CRITICAL: 1 },
        byReviewStatus: { APPROVED: 1, PENDING_REVIEW: 1 },
        byFormation: { "Bassein Limestone": 1, "Mukta Formation": 1 },
      });
      expect(mockWellRepo.findById).toHaveBeenCalledWith(testWell.id);
      expect(mockEventRepo.getSummaryByWellId).toHaveBeenCalledWith(
        testWell.id,
      );
    });

    it("throws 404 NOT_FOUND when requesting summary for nonexistent well", async () => {
      vi.mocked(mockWellRepo.findById).mockResolvedValue(null);

      await expect(
        service.getWellEventSummary("non-existent-well-id"),
      ).rejects.toThrow(/Well not found/i);
    });
  });
});
