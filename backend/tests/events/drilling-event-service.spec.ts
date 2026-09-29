import { describe, it, expect, beforeEach, vi } from "vitest";
import { DrillingEventService } from "@/application/events/drilling-event.service";
import { IDrillingEventRepository } from "@/domain/events/drilling-event.repository.interface";
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

describe("DrillingEventService & Human Review Workflow", () => {
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

  const sampleEvent: DrillingEventEntity = {
    id: "event-uuid-1",
    wellId: testWell.id,
    eventType: EventType.MUD_LOSS,
    depthMd: 2450.125,
    depthTvd: 2200.5,
    formation: "Bassein Limestone",
    severity: EventSeverity.HIGH,
    description:
      "Partial mud loss of 35 bbl/hr observed while drilling through porous limestone section",
    cause: "High-permeability vuggy porosity zone",
    mitigation: "Spotted high-viscosity LCM pill (mica + walnut shells)",
    outcome: "Losses completely arrested; resumed drilling",
    sourceDocumentId: testDocument.id,
    sourcePage: 14,
    extractionConfidence: 0.92,
    reviewStatus: ReviewStatus.PENDING_REVIEW,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockEventRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      findByIdWithSource: vi.fn(),
      listByWellId: vi.fn(),
      listByDocumentId: vi.fn(),
      getSummaryByWellId: vi.fn(),
      update: vi.fn(),
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

    mockDocRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      findByWellAndHash: vi.fn(),
      listByWellId: vi.fn(),
      delete: vi.fn(),
    };

    mockAuditLogRepo = {
      create: vi.fn().mockImplementation((input) =>
        Promise.resolve({
          id: "audit-1",
          actorId: input.actorId ?? null,
          actorRole: input.actorRole ?? null,
          action: input.action,
          resourceType: input.resourceType,
          resourceId: input.resourceId ?? null,
          wellId: input.wellId ?? null,
          details: input.details ?? null,
          createdAt: new Date(),
        }),
      ),
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

  describe("Candidate Event Creation & Provenance Enforcement", () => {
    it("successfully creates a candidate event with initial PENDING_REVIEW state and no reviewer info", async () => {
      vi.mocked(mockWellRepo.findById).mockResolvedValue(testWell);
      vi.mocked(mockDocRepo.findById).mockResolvedValue(testDocument);
      vi.mocked(mockEventRepo.create).mockResolvedValue(sampleEvent);

      const result = await service.createCandidateEvent(
        testWell.id,
        {
          eventType: "MUD_LOSS",
          severity: "HIGH",
          depthMd: 2450.125,
          depthTvd: 2200.5,
          formation: "Bassein Limestone",
          description: "Partial mud loss of 35 bbl/hr observed",
          cause: "High-permeability vuggy zone",
          mitigation: "Spotted LCM pill",
          outcome: "Losses arrested",
          sourceDocumentId: testDocument.id,
          sourcePage: 14,
          extractionConfidence: 0.92,
        },
        "user-eng-1",
      );

      expect(result.id).toBe("event-uuid-1");
      expect(result.reviewStatus).toBe(ReviewStatus.PENDING_REVIEW);
      expect(result.reviewedBy).toBeNull();
      expect(result.reviewedAt).toBeNull();
      expect(result.depthMd).toBe(2450.125);
      expect(result.extractionConfidence).toBe(0.92);

      expect(mockEventRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewStatus: ReviewStatus.PENDING_REVIEW,
          reviewedBy: null,
          reviewedAt: null,
        }),
      );
    });

    it("throws 404 NOT_FOUND when target well does not exist", async () => {
      vi.mocked(mockWellRepo.findById).mockResolvedValue(null);

      await expect(
        service.createCandidateEvent("missing-well", {
          eventType: "KICK",
          severity: "CRITICAL",
          depthMd: 2100,
          description: "Well kick",
          sourceDocumentId: testDocument.id,
          sourcePage: 1,
          extractionConfidence: 0.85,
        }),
      ).rejects.toThrow(/Well not found/i);
    });

    it("throws 404 NOT_FOUND when source document does not exist", async () => {
      vi.mocked(mockWellRepo.findById).mockResolvedValue(testWell);
      vi.mocked(mockDocRepo.findById).mockResolvedValue(null);

      await expect(
        service.createCandidateEvent(testWell.id, {
          eventType: "KICK",
          severity: "CRITICAL",
          depthMd: 2100,
          description: "Well kick",
          sourceDocumentId: "missing-doc-uuid",
          sourcePage: 1,
          extractionConfidence: 0.85,
        }),
      ).rejects.toThrow(/Source document not found/i);
    });

    it("strictly rejects provenance mismatch when source document belongs to another well", async () => {
      vi.mocked(mockWellRepo.findById).mockResolvedValue(testWell);

      const foreignDocument: DocumentEntity = {
        ...testDocument,
        id: "foreign-doc-uuid",
        wellId: "different-well-uuid-999", // Belongs to different well!
      };
      vi.mocked(mockDocRepo.findById).mockResolvedValue(foreignDocument);

      await expect(
        service.createCandidateEvent(testWell.id, {
          eventType: "KICK",
          severity: "CRITICAL",
          depthMd: 2100,
          description: "Well kick",
          sourceDocumentId: foreignDocument.id,
          sourcePage: 1,
          extractionConfidence: 0.85,
        }),
      ).rejects.toThrow(
        /Provenance mismatch: Source document belongs to a different well/i,
      );

      expect(mockEventRepo.create).not.toHaveBeenCalled();
    });

    it("rejects invalid event types", async () => {
      vi.mocked(mockWellRepo.findById).mockResolvedValue(testWell);

      await expect(
        service.createCandidateEvent(testWell.id, {
          eventType: "EXPLOSION_HAZARD", // Invalid!
          severity: "HIGH",
          depthMd: 1500,
          description: "Invalid event",
          sourceDocumentId: testDocument.id,
          sourcePage: 1,
          extractionConfidence: 0.8,
        }),
      ).rejects.toThrow(/Invalid eventType/i);
    });

    it("rejects negative depth values", async () => {
      vi.mocked(mockWellRepo.findById).mockResolvedValue(testWell);

      await expect(
        service.createCandidateEvent(testWell.id, {
          eventType: "STUCK_PIPE",
          severity: "HIGH",
          depthMd: -100, // Invalid!
          description: "Pipe stuck",
          sourceDocumentId: testDocument.id,
          sourcePage: 1,
          extractionConfidence: 0.8,
        }),
      ).rejects.toThrow(/Depth cannot be negative/i);
    });

    it("rejects sourcePage less than 1 (0 or negative)", async () => {
      vi.mocked(mockWellRepo.findById).mockResolvedValue(testWell);

      await expect(
        service.createCandidateEvent(testWell.id, {
          eventType: "STUCK_PIPE",
          severity: "HIGH",
          depthMd: 1200,
          description: "Pipe stuck",
          sourceDocumentId: testDocument.id,
          sourcePage: 0, // Invalid!
          extractionConfidence: 0.8,
        }),
      ).rejects.toThrow(/sourcePage must be greater than or equal to 1/i);
    });

    it("rejects extractionConfidence outside the range [0.0, 1.0]", async () => {
      vi.mocked(mockWellRepo.findById).mockResolvedValue(testWell);

      await expect(
        service.createCandidateEvent(testWell.id, {
          eventType: "STUCK_PIPE",
          severity: "HIGH",
          depthMd: 1200,
          description: "Pipe stuck",
          sourceDocumentId: testDocument.id,
          sourcePage: 1,
          extractionConfidence: 1.5, // Invalid!
        }),
      ).rejects.toThrow(/extractionConfidence must be between 0.0 and 1.0/i);

      await expect(
        service.createCandidateEvent(testWell.id, {
          eventType: "STUCK_PIPE",
          severity: "HIGH",
          depthMd: 1200,
          description: "Pipe stuck",
          sourceDocumentId: testDocument.id,
          sourcePage: 1,
          extractionConfidence: -0.1, // Invalid!
        }),
      ).rejects.toThrow(/extractionConfidence must be between 0.0 and 1.0/i);
    });
  });

  describe("Event Listing & Detail Retrieval", () => {
    it("lists events for a well with optional filters", async () => {
      vi.mocked(mockWellRepo.findById).mockResolvedValue(testWell);
      vi.mocked(mockEventRepo.listByWellId).mockResolvedValue({
        items: [sampleEvent],
        pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      });

      const events = await service.listEventsByWell(testWell.id, {
        eventType: EventType.MUD_LOSS,
        severity: EventSeverity.HIGH,
      });

      expect(events).toHaveLength(1);
      expect(events[0].id).toBe("event-uuid-1");
      expect(mockEventRepo.listByWellId).toHaveBeenCalledWith(
        testWell.id,
        expect.objectContaining({
          eventType: EventType.MUD_LOSS,
          severity: EventSeverity.HIGH,
        }),
      );
    });

    it("retrieves event detail along with safe source document provenance metadata", async () => {
      vi.mocked(mockEventRepo.findByIdWithSource).mockResolvedValue({
        event: sampleEvent,
        sourceDocument: {
          id: testDocument.id,
          filename: testDocument.filename,
          mimeType: testDocument.mimeType,
          documentType: testDocument.documentType,
        },
      });

      const detail = await service.getEventDetail(sampleEvent.id);

      expect(detail.id).toBe(sampleEvent.id);
      expect(detail.sourceDocument.filename).toBe(
        "daily_drilling_report_05.pdf",
      );
      expect(detail.sourceDocument.documentType).toBe("DDR");
      // Verify no internal storageKey or physical path leakage
      expect((detail as any).storageKey).toBeUndefined();
      expect((detail.sourceDocument as any).storageKey).toBeUndefined();
    });

    it("throws 404 NOT_FOUND if event detail is requested for missing ID", async () => {
      vi.mocked(mockEventRepo.findByIdWithSource).mockResolvedValue(null);

      await expect(service.getEventDetail("non-existent-id")).rejects.toThrow(
        /Drilling event not found/i,
      );
    });
  });

  describe("Human Review Workflow State Machine", () => {
    it("transitions PENDING_REVIEW -> APPROVED and records reviewer identity & server timestamp", async () => {
      vi.mocked(mockEventRepo.findById).mockResolvedValue(sampleEvent);

      const approvedEvent: DrillingEventEntity = {
        ...sampleEvent,
        reviewStatus: ReviewStatus.APPROVED,
        reviewedBy: "reviewer-eng-1",
        reviewedAt: new Date(),
      };
      vi.mocked(mockEventRepo.update).mockResolvedValue(approvedEvent);

      const result = await service.reviewEvent(
        sampleEvent.id,
        { action: "APPROVE" },
        "reviewer-eng-1",
        "DRILLING_ENGINEER",
      );

      expect(result.reviewStatus).toBe(ReviewStatus.APPROVED);
      expect(result.reviewedBy).toBe("reviewer-eng-1");
      expect(result.reviewedAt).not.toBeNull();

      expect(mockEventRepo.update).toHaveBeenCalledWith(
        sampleEvent.id,
        expect.objectContaining({
          reviewStatus: ReviewStatus.APPROVED,
          reviewedBy: "reviewer-eng-1",
          reviewedAt: expect.any(Date),
        }),
      );
    });

    it("transitions PENDING_REVIEW -> EDITED and applies corrected fields with validation", async () => {
      vi.mocked(mockEventRepo.findById).mockResolvedValue(sampleEvent);

      const editedEvent: DrillingEventEntity = {
        ...sampleEvent,
        severity: EventSeverity.CRITICAL,
        depthMd: 2465.5,
        reviewStatus: ReviewStatus.EDITED,
        reviewedBy: "reviewer-eng-1",
        reviewedAt: new Date(),
      };
      vi.mocked(mockEventRepo.update).mockResolvedValue(editedEvent);

      const result = await service.reviewEvent(
        sampleEvent.id,
        {
          action: "EDIT",
          editedFields: {
            severity: "CRITICAL",
            depthMd: 2465.5,
          },
        },
        "reviewer-eng-1",
        "DRILLING_ENGINEER",
      );

      expect(result.reviewStatus).toBe(ReviewStatus.EDITED);
      expect(result.severity).toBe(EventSeverity.CRITICAL);
      expect(result.depthMd).toBe(2465.5);
      expect(result.reviewedBy).toBe("reviewer-eng-1");

      expect(mockEventRepo.update).toHaveBeenCalledWith(
        sampleEvent.id,
        expect.objectContaining({
          severity: "CRITICAL",
          depthMd: 2465.5,
          reviewStatus: ReviewStatus.EDITED,
          reviewedBy: "reviewer-eng-1",
        }),
      );
    });

    it("transitions PENDING_REVIEW -> INVALIDATED and marks event invalid without deleting it", async () => {
      vi.mocked(mockEventRepo.findById).mockResolvedValue(sampleEvent);

      const invalidatedEvent: DrillingEventEntity = {
        ...sampleEvent,
        reviewStatus: ReviewStatus.INVALIDATED,
        reviewedBy: "reviewer-geo-1",
        reviewedAt: new Date(),
      };
      vi.mocked(mockEventRepo.update).mockResolvedValue(invalidatedEvent);

      const result = await service.reviewEvent(
        sampleEvent.id,
        { action: "INVALIDATE" },
        "reviewer-geo-1",
        "GEOLOGIST",
      );

      expect(result.reviewStatus).toBe(ReviewStatus.INVALIDATED);
      expect(result.reviewedBy).toBe("reviewer-geo-1");
      expect(result.reviewedAt).not.toBeNull();

      // Crucial: ensure delete was NEVER called
      expect(mockEventRepo.delete).not.toHaveBeenCalled();
      expect(mockEventRepo.update).toHaveBeenCalledWith(
        sampleEvent.id,
        expect.objectContaining({
          reviewStatus: ReviewStatus.INVALIDATED,
          reviewedBy: "reviewer-geo-1",
        }),
      );
    });

    it("rejects review attempts on events that have already been finalized (no backward transition)", async () => {
      const alreadyApprovedEvent: DrillingEventEntity = {
        ...sampleEvent,
        reviewStatus: ReviewStatus.APPROVED,
        reviewedBy: "past-reviewer",
        reviewedAt: new Date(),
      };
      vi.mocked(mockEventRepo.findById).mockResolvedValue(alreadyApprovedEvent);

      await expect(
        service.reviewEvent(
          sampleEvent.id,
          { action: "EDIT", editedFields: { severity: "LOW" } },
          "attacker",
        ),
      ).rejects.toThrow(/Event has already been reviewed/i);

      expect(mockEventRepo.update).not.toHaveBeenCalled();
    });

    it("throws 400 VALIDATION_ERROR when EDIT action is missing editedFields", async () => {
      vi.mocked(mockEventRepo.findById).mockResolvedValue(sampleEvent);

      await expect(
        service.reviewEvent(sampleEvent.id, { action: "EDIT" }, "reviewer-1"),
      ).rejects.toThrow(
        /editedFields with at least one modified property is required/i,
      );
    });

    it("re-verifies provenance when sourceDocumentId is modified during EDIT", async () => {
      vi.mocked(mockEventRepo.findById).mockResolvedValue(sampleEvent);

      const foreignDocument: DocumentEntity = {
        ...testDocument,
        id: "foreign-doc-2",
        wellId: "other-well-999",
      };
      vi.mocked(mockDocRepo.findById).mockResolvedValue(foreignDocument);

      await expect(
        service.reviewEvent(
          sampleEvent.id,
          {
            action: "EDIT",
            editedFields: {
              sourceDocumentId: foreignDocument.id,
            },
          },
          "reviewer-1",
        ),
      ).rejects.toThrow(
        /Provenance mismatch: New source document belongs to a different well/i,
      );

      expect(mockEventRepo.update).not.toHaveBeenCalled();
    });
  });
});
