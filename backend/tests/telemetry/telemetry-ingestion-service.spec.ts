import { describe, it, expect, vi, beforeEach } from "vitest";
import { TelemetryIngestionService } from "@/application/telemetry/telemetry-ingestion.service";
import { ITelemetryRepository } from "@/domain/telemetry/telemetry.repository.interface";
import { IWellRepository } from "@/domain/wells/well.repository.interface";
import { IAuditLogRepository } from "@/domain/audit/audit-log.repository.interface";
import { ITelemetrySourceAdapter } from "@/domain/telemetry/telemetry-adapter.interface";
import {
  CanonicalTelemetryReading,
  CreateTelemetryInput,
  PaginatedTelemetryResult,
} from "@/domain/telemetry/telemetry.entity";
import { AppError } from "@/lib/errors";
import { WellEntity } from "@/domain/wells/well.entity";

describe("Telemetry Ingestion Service & Idempotency", () => {
  let mockTelemetryRepo: ITelemetryRepository;
  let mockWellRepo: IWellRepository;
  let mockAuditRepo: IAuditLogRepository;
  let mockAdapter: ITelemetrySourceAdapter;
  let service: TelemetryIngestionService;

  const sampleWell: WellEntity = {
    id: "well-uuid-1",
    wellId: "WELL-001",
    name: "Alpha-1",
    field: "Mumbai High",
    latitude: 19.25,
    longitude: 71.35,
    plannedDepthMd: 3500,
    plannedDepthTvd: 3200,
    status: "DRILLING",
    spudDate: new Date("2026-01-01"),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleReading: CanonicalTelemetryReading = {
    id: "telemetry-uuid-1",
    wellId: "well-uuid-1",
    sourceId: "RIG-01",
    sequenceNumber: 101,
    timestamp: new Date("2026-09-28T12:00:00Z"),
    measurements: {
      depthMd: 2500,
      depthTvd: 2480,
      rateOfPenetration: 15.2,
      hookLoad: 210,
      standpipePressure: 3100,
      annularPressure: 140,
      surfaceTorque: 14000,
      rotaryRpm: 110,
      flowRateIn: 600,
      flowRateOut: 595,
      mudDensity: 10.5,
    },
    metadata: { bit: "PDC" },
    ingestedAt: new Date("2026-09-28T12:00:01Z"),
    createdAt: new Date("2026-09-28T12:00:01Z"),
  };

  const sampleInput: CreateTelemetryInput = {
    wellId: "well-uuid-1",
    sourceId: "RIG-01",
    sequenceNumber: 101,
    timestamp: new Date("2026-09-28T12:00:00Z"),
    measurements: {
      depthMd: 2500,
      depthTvd: 2480,
      rateOfPenetration: 15.2,
      hookLoad: 210,
      standpipePressure: 3100,
      annularPressure: 140,
      surfaceTorque: 14000,
      rotaryRpm: 110,
      flowRateIn: 600,
      flowRateOut: 595,
      mudDensity: 10.5,
    },
    metadata: { bit: "PDC" },
  };

  beforeEach(() => {
    mockTelemetryRepo = {
      create: vi.fn().mockResolvedValue(sampleReading),
      findByWellSourceSequence: vi.fn().mockResolvedValue(null),
      listByWellId: vi.fn().mockResolvedValue({
        wellId: "well-uuid-1",
        items: [sampleReading],
        pagination: { page: 1, pageSize: 50, totalItems: 1, totalPages: 1 },
        timeRange: {},
      } as PaginatedTelemetryResult),
    };

    mockWellRepo = {
      create: vi.fn(),
      findById: vi.fn().mockResolvedValue(sampleWell),
      findByWellId: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
      findNearby: vi.fn(),
    };

    mockAuditRepo = {
      create: vi.fn().mockResolvedValue({
        id: "audit-1",
        action: "TELEMETRY_INGEST",
        resourceType: "TELEMETRY_READING",
        resourceId: "telemetry-uuid-1",
        wellId: "well-uuid-1",
        createdAt: new Date(),
      }),
      list: vi.fn(),
      findById: vi.fn(),
    };

    mockAdapter = {
      adapt: vi.fn().mockReturnValue(sampleInput),
    };

    service = new TelemetryIngestionService(
      mockTelemetryRepo,
      mockWellRepo,
      mockAuditRepo,
      mockAdapter,
    );
  });

  describe("Ingestion & Validation", () => {
    it("successfully ingests a new telemetry reading", async () => {
      const result = await service.ingest(sampleInput);

      expect(result.status).toBe("INGESTED");
      expect(result.isDuplicate).toBe(false);
      expect(result.reading.id).toBe("telemetry-uuid-1");
      expect(mockWellRepo.findById).toHaveBeenCalledWith("well-uuid-1");
      expect(mockTelemetryRepo.create).toHaveBeenCalledWith(sampleInput);
      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "TELEMETRY_INGEST",
          resourceType: "TELEMETRY_READING",
          resourceId: "telemetry-uuid-1",
          wellId: "well-uuid-1",
        }),
      );
    });

    it("rejects ingestion if the referenced well does not exist", async () => {
      vi.mocked(mockWellRepo.findById).mockResolvedValue(null);

      await expect(service.ingest(sampleInput)).rejects.toThrow(AppError);
      await expect(service.ingest(sampleInput)).rejects.toThrow(
        "Well not found",
      );
      expect(mockTelemetryRepo.create).not.toHaveBeenCalled();
    });

    it("handles idempotency: returns ALREADY_INGESTED when duplicate sequence is received", async () => {
      vi.mocked(mockTelemetryRepo.findByWellSourceSequence).mockResolvedValue(
        sampleReading,
      );

      const result = await service.ingest(sampleInput);

      expect(result.status).toBe("ALREADY_INGESTED");
      expect(result.isDuplicate).toBe(true);
      expect(result.reading).toEqual(sampleReading);
      expect(mockTelemetryRepo.create).not.toHaveBeenCalled();
    });

    it("handles out-of-order telemetry: accepts packet with older timestamp without rejection", async () => {
      const delayedReadingInput: CreateTelemetryInput = {
        ...sampleInput,
        sequenceNumber: 99,
        timestamp: new Date("2026-09-28T11:45:00Z"), // Earlier timestamp
      };

      const delayedReadingResult: CanonicalTelemetryReading = {
        ...sampleReading,
        sequenceNumber: 99,
        timestamp: new Date("2026-09-28T11:45:00Z"),
      };

      vi.mocked(mockAdapter.adapt).mockReturnValue(delayedReadingInput);
      vi.mocked(mockTelemetryRepo.create).mockResolvedValue(
        delayedReadingResult,
      );

      const result = await service.ingest(delayedReadingInput);

      expect(result.status).toBe("INGESTED");
      expect(result.isDuplicate).toBe(false);
      expect(result.reading.timestamp.toISOString()).toBe(
        "2026-09-28T11:45:00.000Z",
      );
      expect(mockTelemetryRepo.create).toHaveBeenCalledWith(
        delayedReadingInput,
      );
    });
  });

  describe("Telemetry Retrieval & Time-Series Filtering", () => {
    it("successfully retrieves paginated telemetry for an existing well", async () => {
      const queryParams = {
        from: "2026-09-28T00:00:00.000Z",
        to: "2026-09-28T23:59:59.000Z",
        page: "1",
        pageSize: "25",
        sortOrder: "asc",
      };

      const result = await service.queryTelemetry("well-uuid-1", queryParams);

      expect(result.wellId).toBe("well-uuid-1");
      expect(result.items).toHaveLength(1);
      expect(mockTelemetryRepo.listByWellId).toHaveBeenCalledWith(
        "well-uuid-1",
        expect.objectContaining({
          page: 1,
          pageSize: 25,
          sortOrder: "asc",
        }),
      );
    });

    it("rejects retrieval if well does not exist", async () => {
      vi.mocked(mockWellRepo.findById).mockResolvedValue(null);

      await expect(
        service.queryTelemetry("non-existent-well", {}),
      ).rejects.toThrow(AppError);
      await expect(
        service.queryTelemetry("non-existent-well", {}),
      ).rejects.toThrow("Well not found");
      expect(mockTelemetryRepo.listByWellId).not.toHaveBeenCalled();
    });

    it("rejects retrieval when from date is after to date", async () => {
      const invalidQuery = {
        from: "2026-09-29T12:00:00.000Z",
        to: "2026-09-28T12:00:00.000Z",
      };

      await expect(
        service.queryTelemetry("well-uuid-1", invalidQuery),
      ).rejects.toThrow(AppError);
    });
  });
});
