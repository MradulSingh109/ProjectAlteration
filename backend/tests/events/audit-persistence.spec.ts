import { describe, it, expect, beforeEach, vi } from "vitest";
import { DrillingEventService } from "@/application/events/drilling-event.service";
import { IDrillingEventRepository } from "@/domain/events/drilling-event.repository.interface";
import { IWellRepository } from "@/domain/wells/well.repository.interface";
import { IDocumentRepository } from "@/domain/documents/document.repository.interface";
import {
  IAuditLogRepository,
  CreateAuditLogInput,
} from "@/domain/audit/audit-log.repository.interface";
import { AuditLogEntity } from "@/domain/audit/audit-log.entity";
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

describe("Drilling Events Durable Audit Trail Persistence", () => {
  let service: DrillingEventService;
  let mockEventRepo: IDrillingEventRepository;
  let mockWellRepo: IWellRepository;
  let mockDocRepo: IDocumentRepository;
  let mockAuditLogRepo: IAuditLogRepository;
  let persistedAuditLogs: AuditLogEntity[];

  const testWell: WellEntity = {
    id: "well-audit-1",
    wellId: "WELL-AUDIT-01",
    name: "Audit Verification Well",
    field: "Mumbai Offshore",
    latitude: 19.5,
    longitude: 71.4,
    plannedDepthMd: 3200.0,
    plannedDepthTvd: 2900.0,
    spudDate: new Date(),
    status: "DRILLING",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const testDocument: DocumentEntity = {
    id: "doc-audit-1",
    wellId: testWell.id,
    filename: "daily_log_01.pdf",
    documentType: DocumentType.DDR,
    mimeType: "application/pdf",
    fileSize: 15000,
    fileHash: "sha256_mock_hash",
    storageKey: `documents/${testWell.id}/doc-audit-1.pdf`,
    uploadedBy: "engineer-1",
    uploadedAt: new Date(),
    ingestionStatus: IngestionStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const testEvent: DrillingEventEntity = {
    id: "event-audit-1",
    wellId: testWell.id,
    eventType: EventType.KICK,
    depthMd: 2500.5,
    depthTvd: 2200.0,
    formation: "Bassein Limestone",
    severity: EventSeverity.HIGH,
    description: "Gas kick observed while drilling",
    cause: "Overpressured gas sand",
    mitigation: "Shut in well with annular preventer",
    outcome: "Well secured",
    sourceDocumentId: testDocument.id,
    sourcePage: 8,
    extractionConfidence: 0.95,
    reviewStatus: ReviewStatus.PENDING_REVIEW,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    persistedAuditLogs = [];

    mockEventRepo = {
      create: vi.fn().mockResolvedValue(testEvent),
      findById: vi.fn().mockResolvedValue(testEvent),
      findByIdWithSource: vi.fn(),
      listByWellId: vi.fn(),
      update: vi.fn().mockImplementation((id, data) =>
        Promise.resolve({
          ...testEvent,
          ...data,
          updatedAt: new Date(),
        }),
      ),
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
      create: vi.fn().mockImplementation((input: CreateAuditLogInput) => {
        const entity: AuditLogEntity = {
          id: `audit-${Date.now()}-${Math.random()}`,
          actorId: input.actorId ?? null,
          actorRole: input.actorRole ?? null,
          action: input.action,
          resourceType: input.resourceType,
          resourceId: input.resourceId ?? null,
          wellId: input.wellId ?? null,
          details: input.details ?? null,
          createdAt: new Date(), // Server-generated timestamp
        };
        persistedAuditLogs.push(entity);
        return Promise.resolve(entity);
      }),
      list: vi
        .fn()
        .mockImplementation(() => Promise.resolve(persistedAuditLogs)),
      findById: vi.fn(),
    };

    service = new DrillingEventService(
      mockEventRepo,
      mockWellRepo,
      mockDocRepo,
      mockAuditLogRepo,
    );
  });

  it("1. Creating an event creates a persistent EVENT_CREATE audit record", async () => {
    await service.createCandidateEvent(
      testWell.id,
      {
        eventType: "KICK",
        severity: "HIGH",
        depthMd: 2500.5,
        description: "Gas kick observed while drilling",
        sourceDocumentId: testDocument.id,
        sourcePage: 8,
        extractionConfidence: 0.95,
      },
      "engineer-actor-id",
      "DRILLING_ENGINEER",
    );

    expect(mockAuditLogRepo.create).toHaveBeenCalledTimes(1);
    const auditRecord = persistedAuditLogs[0];
    expect(auditRecord).toBeDefined();
    expect(auditRecord.action).toBe("EVENT_CREATE");
    expect(auditRecord.resourceType).toBe("DRILLING_EVENT");
    expect(auditRecord.resourceId).toBe(testEvent.id);
    expect(auditRecord.wellId).toBe(testWell.id);
    expect(auditRecord.actorId).toBe("engineer-actor-id");
    expect(auditRecord.actorRole).toBe("DRILLING_ENGINEER");
    expect(auditRecord.createdAt).toBeInstanceOf(Date);
  });

  it("2. Approving an event creates a persistent EVENT_APPROVE audit record", async () => {
    await service.reviewEvent(
      testEvent.id,
      { action: "APPROVE" },
      "reviewer-eng-1",
      "DRILLING_ENGINEER",
    );

    expect(mockAuditLogRepo.create).toHaveBeenCalledTimes(1);
    const auditRecord = persistedAuditLogs[0];
    expect(auditRecord).toBeDefined();
    expect(auditRecord.action).toBe("EVENT_APPROVE");
    expect(auditRecord.resourceType).toBe("DRILLING_EVENT");
    expect(auditRecord.resourceId).toBe(testEvent.id);
    expect(auditRecord.wellId).toBe(testWell.id);
    expect(auditRecord.actorId).toBe("reviewer-eng-1");
    expect(auditRecord.actorRole).toBe("DRILLING_ENGINEER");
  });

  it("3. Editing an event creates a persistent EVENT_EDIT audit record with modification details", async () => {
    await service.reviewEvent(
      testEvent.id,
      {
        action: "EDIT",
        editedFields: {
          severity: "CRITICAL",
          depthMd: 2510.75,
        },
      },
      "reviewer-eng-1",
      "DRILLING_ENGINEER",
    );

    expect(mockAuditLogRepo.create).toHaveBeenCalledTimes(1);
    const auditRecord = persistedAuditLogs[0];
    expect(auditRecord).toBeDefined();
    expect(auditRecord.action).toBe("EVENT_EDIT");
    expect(auditRecord.resourceType).toBe("DRILLING_EVENT");
    expect(auditRecord.resourceId).toBe(testEvent.id);
    expect(auditRecord.actorId).toBe("reviewer-eng-1");
    expect(auditRecord.details).toEqual({
      editedFields: {
        severity: "CRITICAL",
        depthMd: 2510.75,
      },
    });
  });

  it("4. Invalidating an event creates a persistent EVENT_INVALIDATE audit record", async () => {
    await service.reviewEvent(
      testEvent.id,
      { action: "INVALIDATE" },
      "reviewer-geo-1",
      "GEOLOGIST",
    );

    expect(mockAuditLogRepo.create).toHaveBeenCalledTimes(1);
    const auditRecord = persistedAuditLogs[0];
    expect(auditRecord).toBeDefined();
    expect(auditRecord.action).toBe("EVENT_INVALIDATE");
    expect(auditRecord.resourceType).toBe("DRILLING_EVENT");
    expect(auditRecord.resourceId).toBe(testEvent.id);
    expect(auditRecord.actorId).toBe("reviewer-geo-1");
    expect(auditRecord.actorRole).toBe("GEOLOGIST");
  });

  it("5. Audit records identify the authenticated actor and server timestamp", async () => {
    const beforeTime = new Date(Date.now() - 1000);

    await service.reviewEvent(
      testEvent.id,
      { action: "APPROVE" },
      "authenticated-user-999",
      "ADMIN",
    );

    const auditRecord = persistedAuditLogs[0];
    expect(auditRecord.actorId).toBe("authenticated-user-999");
    expect(auditRecord.actorRole).toBe("ADMIN");
    expect(auditRecord.createdAt.getTime()).toBeGreaterThanOrEqual(
      beforeTime.getTime(),
    );
  });

  it("6. Audit records do not contain passwords, tokens, secrets, or binary content", async () => {
    await service.createCandidateEvent(
      testWell.id,
      {
        eventType: "KICK",
        severity: "HIGH",
        depthMd: 2500.5,
        description: "Gas kick observed while drilling",
        sourceDocumentId: testDocument.id,
        sourcePage: 8,
        extractionConfidence: 0.95,
      },
      "engineer-1",
      "DRILLING_ENGINEER",
    );

    const auditRecord = persistedAuditLogs[0];
    const serialized = JSON.stringify(auditRecord);

    expect(serialized).not.toContain("password");
    expect(serialized).not.toContain("access_token");
    expect(serialized).not.toContain("refresh_token");
    expect(serialized).not.toContain("Bearer");
    expect(serialized).not.toContain("storageKey");
    expect(serialized).not.toContain("documents/");
    expect(serialized).not.toContain("%PDF-");
  });
});
