import { describe, it, expect, vi, beforeEach } from "vitest";
import { MlIngestionService } from "@/application/events/ml-ingestion.service";
import { EventType, EventSeverity, ReviewStatus } from "@/domain/events/drilling-event.entity";
import { DocumentType, IngestionStatus } from "@/domain/documents/document.entity";

describe("MlIngestionService & Schema Adapter", () => {
  let service: MlIngestionService;
  let mockDrillingRepo: any;
  let mockWellRepo: any;
  let mockDocumentRepo: any;

  beforeEach(() => {
    mockDrillingRepo = {
      create: vi.fn().mockImplementation(async (data: any) => ({
        id: "generated-uuid-1",
        ...data,
        createdAt: new Date("2026-09-29T10:00:00Z"),
        updatedAt: new Date("2026-09-29T10:00:00Z"),
      })),
      findByMlEventId: vi.fn().mockResolvedValue(null),
    };

    mockWellRepo = {
      findByWellId: vi.fn().mockResolvedValue({
        id: "well-uuid-102",
        wellId: "OIL-102",
        name: "OIL-102",
        field: "UpperAssam",
        latitude: 27.46,
        longitude: 95.06,
      }),
      findById: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
    };

    mockDocumentRepo = {
      findById: vi.fn().mockResolvedValue(null),
      findByWellAndFilename: vi.fn().mockResolvedValue({
        id: "doc-uuid-555",
        wellId: "well-uuid-102",
        filename: "WCR_W087_Final.pdf",
        documentType: DocumentType.WCR,
      }),
      create: vi.fn(),
    };

    service = new MlIngestionService(
      mockDrillingRepo,
      mockWellRepo,
      mockDocumentRepo,
    );
  });

  it("successfully ingests and adapts ML ExtractedEvent with snake_case and missing severity", async () => {
    const rawMlEvents = [
      {
        event_id: "WCR_W087_Final:event-001",
        well_id: "OIL-102",
        event_type: "MUD_LOSS",
        depth_md: 3430,
        depth_tvd: null,
        formation: "Barail Coal-Shale",
        severity: null, // Test fallback to MEDIUM
        description: "Stuck Pipe & Mud Loss @ 3430 m",
        cause: "fractured formation",
        mitigation: "20 bbl LCM Pill",
        outcome: "losses reduced",
        source_document: "WCR_W087_Final.pdf",
        source_page: 1,
        confidence: 0.9,
        npt_hours: 4.5,
        source_section: "EXTRACTED EVENT",
        extraction_model: "nwis-rules-baseline-v1",
        evidence: [{ field: "event_type", quote: "Mud Loss @ 3430 m" }],
      },
    ];

    const result = await service.ingestMlBatch(rawMlEvents, "user-eng-1", "DRILLING_ENGINEER");

    expect(result.totalReceived).toBe(1);
    expect(result.ingestedCount).toBe(1);
    expect(result.skippedDuplicatesCount).toBe(0);

    // Verify repository was called with correct DB UUID and normalized camelCase fields
    expect(mockDrillingRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        wellId: "well-uuid-102",
        sourceDocumentId: "doc-uuid-555",
        eventType: EventType.MUD_LOSS,
        depthMd: 3430,
        severity: EventSeverity.MEDIUM, // defaulted from null
        extractionConfidence: 0.9,
        reviewStatus: ReviewStatus.PENDING_REVIEW,
        nptHours: 4.5,
        sourceSection: "EXTRACTED EVENT",
        extractionModel: "nwis-rules-baseline-v1",
        mlEventId: "WCR_W087_Final:event-001",
        evidence: [{ field: "event_type", quote: "Mud Loss @ 3430 m" }],
      }),
    );

    expect(result.events[0].id).toBe("generated-uuid-1");
    expect(result.events[0].severity).toBe(EventSeverity.MEDIUM);
    expect(result.events[0].nptHours).toBe(4.5);
    expect(result.events[0].mlEventId).toBe("WCR_W087_Final:event-001");
  });

  it("skips duplicates when event_id was previously ingested", async () => {
    mockDrillingRepo.findByMlEventId.mockResolvedValueOnce({
      id: "already-ingested-uuid",
      mlEventId: "WCR_W087_Final:event-001",
    });

    const rawMlEvents = [
      {
        event_id: "WCR_W087_Final:event-001",
        well_id: "OIL-102",
        event_type: "MUD_LOSS",
        depth_md: 3430,
        description: "Duplicate event",
      },
    ];

    const result = await service.ingestMlBatch(rawMlEvents);
    expect(result.ingestedCount).toBe(0);
    expect(result.skippedDuplicatesCount).toBe(1);
    expect(mockDrillingRepo.create).not.toHaveBeenCalled();
  });
});
