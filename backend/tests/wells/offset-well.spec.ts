import { describe, it, expect, vi, beforeEach } from "vitest";
import { OffsetWellService } from "@/application/wells/offset-well.service";
import {
  IOffsetWellRepository,
  RawOffsetEvent,
} from "@/domain/wells/offset-well.repository.interface";
import { IWellRepository } from "@/domain/wells/well.repository.interface";
import { WellEntity, WellStatus } from "@/domain/wells/well.entity";
import { FormationEntity } from "@/domain/wells/formation.entity";
import {
  EventType,
  EventSeverity,
  ReviewStatus,
} from "@/domain/events/drilling-event.entity";
import { AppError } from "@/lib/errors";

describe("Step 9 — Offset Well Intelligence & Deterministic Similarity Foundation", () => {
  let service: OffsetWellService;
  let mockOffsetRepo: IOffsetWellRepository;
  let mockWellRepo: IWellRepository;

  const refWell: WellEntity & { formations: FormationEntity[] } = {
    id: "ref-well-uuid-1",
    wellId: "WELL-REF-01",
    name: "Reference Well Alpha",
    field: "Mumbai High",
    latitude: 19.4567,
    longitude: 71.3456,
    spudDate: new Date("2024-01-15"),
    plannedDepthMd: 3500.0,
    plannedDepthTvd: 3200.0,
    status: WellStatus.DRILLING,
    createdAt: new Date(),
    updatedAt: new Date(),
    formations: [
      {
        id: "form-ref-1",
        wellId: "ref-well-uuid-1",
        name: "Bassein Limestone",
        topMd: 2100.0,
        bottomMd: 2600.0,
        lithology: "Limestone",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "form-ref-2",
        wellId: "ref-well-uuid-1",
        name: "Panna Formation",
        topMd: 2700.0,
        bottomMd: 3100.0,
        lithology: "Shale",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  };

  const candidate1 = {
    id: "cand-well-uuid-1",
    wellId: "WELL-CAND-01",
    name: "Candidate Well Beta",
    field: "Mumbai High",
    status: WellStatus.COMPLETED,
    latitude: 19.46,
    longitude: 71.35,
    plannedDepthMd: 3400.0,
    plannedDepthTvd: 3150.0,
    spudDate: new Date("2023-05-10"),
    distanceKm: 5.25,
  };

  const cand1Formations: FormationEntity[] = [
    {
      id: "form-cand1-1",
      wellId: "cand-well-uuid-1",
      name: "Bassein Limestone",
      topMd: 2050.0,
      bottomMd: 2550.0, // Overlaps [2100, 2600] by 450m
      lithology: "Limestone",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "form-cand1-2",
      wellId: "cand-well-uuid-1",
      name: "Panna Formation",
      topMd: 2750.0,
      bottomMd: 3200.0, // Overlaps [2700, 3100] by 350m
      lithology: "Shale",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const cand1Events: RawOffsetEvent[] = [
    {
      wellId: "cand-well-uuid-1",
      eventType: EventType.KICK,
      severity: EventSeverity.HIGH,
      reviewStatus: ReviewStatus.APPROVED,
      depthMd: 2200.0, // Inside Bassein Limestone & depth overlap
      formation: "Bassein Limestone",
    },
    {
      wellId: "cand-well-uuid-1",
      eventType: EventType.MUD_LOSS,
      severity: EventSeverity.CRITICAL,
      reviewStatus: ReviewStatus.APPROVED,
      depthMd: 2450.5, // Inside Bassein Limestone & depth overlap
      formation: "Bassein Limestone",
    },
  ];

  const candidate2 = {
    id: "cand-well-uuid-2",
    wellId: "WELL-CAND-02",
    name: "Candidate Well Gamma",
    field: "Mumbai High",
    status: WellStatus.COMPLETED,
    latitude: 19.48,
    longitude: 71.37,
    plannedDepthMd: 2800.0,
    plannedDepthTvd: 2600.0,
    spudDate: new Date("2022-08-20"),
    distanceKm: 12.8,
  };

  const cand2Formations: FormationEntity[] = [
    {
      id: "form-cand2-1",
      wellId: "cand-well-uuid-2",
      name: "Heera Formation", // No overlap with reference formations
      topMd: 1800.0,
      bottomMd: 2300.0,
      lithology: "Sandstone",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const cand2Events: RawOffsetEvent[] = [
    {
      wellId: "cand-well-uuid-2",
      eventType: EventType.STUCK_PIPE,
      severity: EventSeverity.MEDIUM,
      reviewStatus: ReviewStatus.APPROVED,
      depthMd: 2100.0,
      formation: "Heera Formation",
    },
  ];

  beforeEach(() => {
    mockWellRepo = {
      create: vi.fn(),
      findById: vi.fn().mockImplementation(async (id: string) => {
        if (id === refWell.id) return refWell;
        return null;
      }),
      findByWellId: vi.fn().mockImplementation(async (wellId: string) => {
        if (wellId === refWell.wellId) return refWell;
        return null;
      }),
      list: vi.fn(),
      update: vi.fn(),
      findNearby: vi.fn(),
    };

    mockOffsetRepo = {
      findOffsetCandidatesData: vi.fn().mockResolvedValue({
        candidates: [candidate1, candidate2],
        formationsByWellId: new Map([
          [candidate1.id, cand1Formations],
          [candidate2.id, cand2Formations],
        ]),
        eventsByWellId: new Map([
          [candidate1.id, cand1Events],
          [candidate2.id, cand2Events],
        ]),
      }),
    };

    service = new OffsetWellService(mockOffsetRepo, mockWellRepo);
  });

  describe("Phase 1 & 2: Query Contract and Reference Well Validation", () => {
    it("successfully retrieves offset wells for an existing reference well", async () => {
      const result = await service.findOffsetWells(refWell.id);

      expect(result.referenceWell.id).toBe(refWell.id);
      expect(result.referenceWell.wellId).toBe(refWell.wellId);
      expect(result.items).toHaveLength(2);
      expect(result.pagination.totalItems).toBe(2);
    });

    it("supports lookup by business wellId", async () => {
      const result = await service.findOffsetWells(refWell.wellId);

      expect(result.referenceWell.id).toBe(refWell.id);
      expect(result.items).toHaveLength(2);
    });

    it("throws 404 NOT_FOUND when reference well does not exist", async () => {
      await expect(
        service.findOffsetWells("nonexistent-well-id"),
      ).rejects.toThrow(/Reference well 'nonexistent-well-id' not found/i);
    });

    it("throws 400 BAD_REQUEST when wellId is empty or blank", async () => {
      await expect(service.findOffsetWells("   ")).rejects.toThrow(
        /Reference well identifier is required/i,
      );
    });
  });

  describe("Phase 3 & 4: Spatial Proximity & Radius Validation", () => {
    it("passes search radius to repository and enforces exclusion of reference well", async () => {
      await service.findOffsetWells(refWell.id, { radiusKm: 30 });

      expect(mockOffsetRepo.findOffsetCandidatesData).toHaveBeenCalledWith(
        refWell.latitude,
        refWell.longitude,
        30,
        refWell.id,
        200,
      );
    });

    it("rejects non-positive radius (radius <= 0)", async () => {
      await expect(
        service.findOffsetWells(refWell.id, { radiusKm: 0 }),
      ).rejects.toThrow(/radiusKm must be greater than 0/i);

      await expect(
        service.findOffsetWells(refWell.id, { radiusKm: -5 }),
      ).rejects.toThrow(/radiusKm must be greater than 0/i);
    });

    it("rejects radius exceeding maximum operational threshold of 100 km", async () => {
      await expect(
        service.findOffsetWells(refWell.id, { radiusKm: 150 }),
      ).rejects.toThrow(
        /radiusKm must not exceed maximum operational threshold of 100 km/i,
      );
    });

    it("rejects malformed or NaN radius values", async () => {
      await expect(
        service.findOffsetWells(refWell.id, { radiusKm: "not-a-number" }),
      ).rejects.toThrow(/radiusKm must be a number/i);
    });
  });

  describe("Phase 5: Formation Stratigraphic Overlap", () => {
    it("correctly identifies overlapping formation intervals and calculates overlap length", async () => {
      const result = await service.findOffsetWells(refWell.id);
      const cand1Item = result.items.find(
        (i) => i.offsetWell.id === candidate1.id,
      )!;

      expect(cand1Item.formationMatches).toHaveLength(2);

      // Bassein Limestone: Ref [2100, 2600], Cand [2050, 2550] -> overlap [2100, 2550], length 450m
      const basseinMatch = cand1Item.formationMatches.find(
        (m) => m.formation === "Bassein Limestone",
      )!;
      expect(basseinMatch.overlapStartMd).toBe(2100.0);
      expect(basseinMatch.overlapEndMd).toBe(2550.0);
      expect(basseinMatch.overlapLengthMd).toBe(450.0);

      // Panna Formation: Ref [2700, 3100], Cand [2750, 3200] -> overlap [2750, 3100], length 350m
      const pannaMatch = cand1Item.formationMatches.find(
        (m) => m.formation === "Panna Formation",
      )!;
      expect(pannaMatch.overlapStartMd).toBe(2750.0);
      expect(pannaMatch.overlapEndMd).toBe(3100.0);
      expect(pannaMatch.overlapLengthMd).toBe(350.0);
    });

    it("yields empty formation matches when formations do not match", async () => {
      const result = await service.findOffsetWells(refWell.id);
      const cand2Item = result.items.find(
        (i) => i.offsetWell.id === candidate2.id,
      )!;

      // Candidate 2 only has Heera Formation, which is not in Ref well
      expect(cand2Item.formationMatches).toHaveLength(0);
    });

    it("handles boundary-touching formation intervals with 0m overlap length", async () => {
      const boundaryCandidate = {
        ...candidate1,
        id: "cand-boundary",
      };
      const boundaryFormations: FormationEntity[] = [
        {
          id: "form-b-1",
          wellId: "cand-boundary",
          name: "Bassein Limestone",
          topMd: 2600.0, // Exactly touches ref bottom 2600.0
          bottomMd: 3000.0,
          lithology: "Limestone",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(mockOffsetRepo.findOffsetCandidatesData).mockResolvedValueOnce({
        candidates: [boundaryCandidate],
        formationsByWellId: new Map([
          [boundaryCandidate.id, boundaryFormations],
        ]),
        eventsByWellId: new Map(),
      });

      const result = await service.findOffsetWells(refWell.id);
      expect(result.items).toHaveLength(1);
      const match = result.items[0].formationMatches[0];
      expect(match.overlapStartMd).toBe(2600.0);
      expect(match.overlapEndMd).toBe(2600.0);
      expect(match.overlapLengthMd).toBe(0);
    });
  });

  describe("Phase 6: Borehole Depth Interval Overlap", () => {
    it("calculates borehole depth interval overlap and overlap ratio", async () => {
      const result = await service.findOffsetWells(refWell.id);
      const cand1Item = result.items.find(
        (i) => i.offsetWell.id === candidate1.id,
      )!;

      // Ref well plannedDepthMd: 3500m, Cand 1 plannedDepthMd: 3400m
      // Depth overlap: [0, 3400], length 3400m, ratio: 3400 / 3500 = 0.971
      expect(cand1Item.depthOverlap.exists).toBe(true);
      expect(cand1Item.depthOverlap.overlapStartMd).toBe(0);
      expect(cand1Item.depthOverlap.overlapEndMd).toBe(3400.0);
      expect(cand1Item.depthOverlap.overlapLengthMd).toBe(3400.0);
      expect(cand1Item.depthOverlap.overlapRatio).toBeCloseTo(0.971, 3);
    });
  });

  describe("Phase 7: Historical Event Evidence Aggregation", () => {
    it("aggregates events by eventType, severity, reviewStatus, and identifies events in overlapping formations/depths", async () => {
      const result = await service.findOffsetWells(refWell.id);
      const cand1Item = result.items.find(
        (i) => i.offsetWell.id === candidate1.id,
      )!;

      expect(cand1Item.historicalEvents.totalEvents).toBe(2);
      expect(cand1Item.historicalEvents.byEventType[EventType.KICK]).toBe(1);
      expect(cand1Item.historicalEvents.byEventType[EventType.MUD_LOSS]).toBe(
        1,
      );
      expect(cand1Item.historicalEvents.bySeverity[EventSeverity.HIGH]).toBe(1);
      expect(
        cand1Item.historicalEvents.bySeverity[EventSeverity.CRITICAL],
      ).toBe(1);
      expect(cand1Item.historicalEvents.eventsInOverlappingFormations).toBe(2);
      expect(cand1Item.historicalEvents.eventsInDepthOverlap).toBe(2);
    });
  });

  describe("Phase 8 & 9: Deterministic Multi-Factor Relevance Scoring", () => {
    it("computes bounded relevance score [0.000, 1.000] and factors", async () => {
      const result = await service.findOffsetWells(refWell.id, {
        radiusKm: 25,
      });
      const cand1Item = result.items.find(
        (i) => i.offsetWell.id === candidate1.id,
      )!;

      const { score, factors, method } = cand1Item.relevanceScore;
      expect(method).toBe("DETERMINISTIC_MULTI_FACTOR");
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);

      // Verify individual factor bounds
      expect(factors.spatialProximityScore).toBeGreaterThan(0);
      expect(factors.spatialProximityScore).toBeLessThanOrEqual(1);
      expect(factors.formationOverlapScore).toBeGreaterThan(0);
      expect(factors.depthOverlapScore).toBeGreaterThan(0);
      expect(factors.eventRelevanceScore).toBeGreaterThan(0);
    });

    it("candidate with closer distance and higher formation overlap ranks higher", async () => {
      const result = await service.findOffsetWells(refWell.id, {
        sortBy: "relevanceScore",
        sortOrder: "desc",
      });

      // Candidate 1 (5.25km, 2 formation matches, 2 events) must score higher than Candidate 2 (12.8km, 0 formation matches)
      expect(result.items[0].offsetWell.id).toBe(candidate1.id);
      expect(result.items[0].relevanceScore.score).toBeGreaterThan(
        result.items[1].relevanceScore.score,
      );
    });
  });

  describe("Phase 10: Filtering Options", () => {
    it("filters by formation name", async () => {
      const result = await service.findOffsetWells(refWell.id, {
        formation: "Bassein",
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].offsetWell.id).toBe(candidate1.id);
    });

    it("filters by minDepthOverlapMd", async () => {
      const result = await service.findOffsetWells(refWell.id, {
        minDepthOverlapMd: 3000,
      });

      // Cand 1 has 3400m depth overlap (accepted), Cand 2 has 2800m depth overlap (filtered out)
      expect(result.items).toHaveLength(1);
      expect(result.items[0].offsetWell.id).toBe(candidate1.id);
    });

    it("filters by minEvents", async () => {
      const result = await service.findOffsetWells(refWell.id, {
        minEvents: 2,
      });

      // Cand 1 has 2 events, Cand 2 has 1 event
      expect(result.items).toHaveLength(1);
      expect(result.items[0].offsetWell.id).toBe(candidate1.id);
    });

    it("filters by eventType", async () => {
      const result = await service.findOffsetWells(refWell.id, {
        eventType: EventType.STUCK_PIPE,
      });

      // Cand 2 has STUCK_PIPE event
      expect(result.items).toHaveLength(1);
      expect(result.items[0].offsetWell.id).toBe(candidate2.id);
    });

    it("filters by severity", async () => {
      const result = await service.findOffsetWells(refWell.id, {
        severity: EventSeverity.CRITICAL,
      });

      // Cand 1 has CRITICAL mud loss
      expect(result.items).toHaveLength(1);
      expect(result.items[0].offsetWell.id).toBe(candidate1.id);
    });
  });

  describe("Phase 11: Pagination and Sorting", () => {
    it("supports offset pagination (pageSize = 1)", async () => {
      const page1 = await service.findOffsetWells(refWell.id, {
        page: 1,
        pageSize: 1,
        sortBy: "distance",
        sortOrder: "asc",
      });

      expect(page1.items).toHaveLength(1);
      expect(page1.pagination.totalItems).toBe(2);
      expect(page1.pagination.totalPages).toBe(2);
      expect(page1.items[0].offsetWell.id).toBe(candidate1.id);

      const page2 = await service.findOffsetWells(refWell.id, {
        page: 2,
        pageSize: 1,
        sortBy: "distance",
        sortOrder: "asc",
      });

      expect(page2.items).toHaveLength(1);
      expect(page2.items[0].offsetWell.id).toBe(candidate2.id);
    });

    it("rejects pageSize > 100", async () => {
      await expect(
        service.findOffsetWells(refWell.id, { pageSize: 150 }),
      ).rejects.toThrow(/pageSize cannot exceed 100/i);
    });

    it("rejects invalid sortBy field", async () => {
      await expect(
        service.findOffsetWells(refWell.id, {
          sortBy: "invalid_column" as any,
        }),
      ).rejects.toThrow(/Invalid sortBy field/i);
    });

    it("rejects invalid sortOrder", async () => {
      await expect(
        service.findOffsetWells(refWell.id, { sortOrder: "sideways" as any }),
      ).rejects.toThrow(/sortOrder must be either 'asc' or 'desc'/i);
    });
  });

  describe("Edge Cases", () => {
    it("handles candidate with no formations gracefully", async () => {
      const noFormationCandidate = { ...candidate1, id: "cand-no-form" };
      vi.mocked(mockOffsetRepo.findOffsetCandidatesData).mockResolvedValueOnce({
        candidates: [noFormationCandidate],
        formationsByWellId: new Map(),
        eventsByWellId: new Map(),
      });

      const result = await service.findOffsetWells(refWell.id);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].formationMatches).toHaveLength(0);
      expect(result.items[0].historicalEvents.totalEvents).toBe(0);
      expect(result.items[0].relevanceScore.score).toBeGreaterThan(0);
    });

    it("handles empty candidate results cleanly", async () => {
      vi.mocked(mockOffsetRepo.findOffsetCandidatesData).mockResolvedValueOnce({
        candidates: [],
        formationsByWellId: new Map(),
        eventsByWellId: new Map(),
      });

      const result = await service.findOffsetWells(refWell.id);
      expect(result.items).toHaveLength(0);
      expect(result.pagination.totalItems).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
    });
  });
});
