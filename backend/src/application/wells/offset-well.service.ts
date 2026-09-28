import { IWellRepository } from "@/domain/wells/well.repository.interface";
import { wellRepository as defaultWellRepo } from "@/infrastructure/wells/prisma-well.repository";
import {
  IOffsetWellRepository,
  RawOffsetEvent,
} from "@/domain/wells/offset-well.repository.interface";
import { offsetWellRepository as defaultOffsetRepo } from "@/infrastructure/wells/prisma-offset-well.repository";
import {
  OffsetWellIntelligenceResult,
  OffsetWellIntelligenceItem,
  FormationOverlapMatch,
  DepthOverlapAnalysis,
  OffsetHistoricalEventsSummary,
  RelevanceScoreResult,
  OffsetSortField,
  SortOrder,
} from "@/domain/wells/offset-well.entity";
import { FormationEntity } from "@/domain/wells/formation.entity";
import { AppError } from "@/lib/errors";
import { queryOffsetWellsSchema } from "./offset-well.dto";

function toNum(val: unknown): number {
  if (val && typeof val === "object" && "toNumber" in val) {
    return (val as { toNumber(): number }).toNumber();
  }
  return Number(val || 0);
}

export class OffsetWellService {
  constructor(
    private readonly offsetRepo: IOffsetWellRepository = defaultOffsetRepo,
    private readonly wellRepo: IWellRepository = defaultWellRepo,
  ) {}

  /**
   * Discovers and evaluates candidate offset wells for a specified reference well.
   * Deterministically analyzes spatial proximity, stratigraphic formation overlap,
   * borehole depth interval overlap, and historical drilling events.
   *
   * @param referenceWellId - Primary UUID or business identifier of the reference well.
   * @param rawQuery - Unvalidated HTTP query parameters.
   */
  async findOffsetWells(
    referenceWellId: string,
    rawQuery?: unknown,
  ): Promise<OffsetWellIntelligenceResult> {
    if (!referenceWellId || !referenceWellId.trim()) {
      throw AppError.badRequest("Reference well identifier is required");
    }

    // 1. Retrieve reference well (with formations)
    let refWell = await this.wellRepo.findById(referenceWellId);
    if (!refWell) {
      refWell = await this.wellRepo.findByWellId(referenceWellId);
    }
    if (!refWell) {
      throw AppError.notFound(`Reference well '${referenceWellId}' not found`);
    }

    const refPlannedDepthMd = toNum(refWell.plannedDepthMd);
    const refPlannedDepthTvd = toNum(refWell.plannedDepthTvd);

    const refFormations: FormationEntity[] = refWell.formations ?? [];

    // 2. Validate query parameters
    const parsed = queryOffsetWellsSchema.safeParse(rawQuery ?? {});
    if (!parsed.success) {
      throw AppError.validation(
        parsed.error.issues[0]?.message || "Invalid query parameters",
        parsed.error.issues,
      );
    }
    const query = parsed.data;

    const sortOrder: SortOrder =
      query.sortOrder ??
      (query.sortBy === "distance" || query.sortBy === "name" ? "asc" : "desc");

    // 3. Retrieve candidate wells, formations, and events via batch repository
    const batch = await this.offsetRepo.findOffsetCandidatesData(
      refWell.latitude,
      refWell.longitude,
      query.radiusKm,
      refWell.id,
      200,
    );

    // 4. Deterministic multi-factor evaluation for each candidate
    const evaluatedItems: OffsetWellIntelligenceItem[] = [];

    for (const candidate of batch.candidates) {
      const candFormations = batch.formationsByWellId.get(candidate.id) ?? [];
      const candEvents = batch.eventsByWellId.get(candidate.id) ?? [];

      // A. Formation Stratigraphic Overlap Calculation
      const formationMatches: FormationOverlapMatch[] = [];
      for (const refF of refFormations) {
        const refTop = toNum(refF.topMd);
        const refBottom = toNum(refF.bottomMd);

        // Match by normalized formation name (case-insensitive)
        const matchingCandFormations = candFormations.filter(
          (cf) =>
            cf.name.trim().toLowerCase() === refF.name.trim().toLowerCase(),
        );

        for (const candF of matchingCandFormations) {
          const candTop = toNum(candF.topMd);
          const candBottom = toNum(candF.bottomMd);

          // Two intervals overlap when: candidateTop <= referenceBottom AND candidateBottom >= referenceTop
          if (candTop <= refBottom && candBottom >= refTop) {
            const overlapStartMd = Math.max(refTop, candTop);
            const overlapEndMd = Math.min(refBottom, candBottom);
            const overlapLengthMd = Math.max(
              0,
              Math.round((overlapEndMd - overlapStartMd) * 1000) / 1000,
            );

            formationMatches.push({
              formation: refF.name,
              referenceInterval: { topMd: refTop, bottomMd: refBottom },
              offsetInterval: { topMd: candTop, bottomMd: candBottom },
              overlapStartMd,
              overlapEndMd,
              overlapLengthMd,
            });
          }
        }
      }

      // B. Borehole Depth Interval Overlap Calculation
      const candPlannedDepthMd = candidate.plannedDepthMd;
      const depthOverlapStartMd = 0;
      const depthOverlapEndMd = Math.min(refPlannedDepthMd, candPlannedDepthMd);
      const depthOverlapLengthMd = Math.max(
        0,
        Math.round((depthOverlapEndMd - depthOverlapStartMd) * 1000) / 1000,
      );
      const maxPlannedDepth = Math.max(refPlannedDepthMd, candPlannedDepthMd);
      const depthOverlapRatio =
        maxPlannedDepth > 0
          ? Math.round((depthOverlapLengthMd / maxPlannedDepth) * 1000) / 1000
          : 0;

      const depthOverlap: DepthOverlapAnalysis = {
        exists: depthOverlapLengthMd > 0,
        overlapStartMd: depthOverlapStartMd,
        overlapEndMd: depthOverlapEndMd,
        overlapLengthMd: depthOverlapLengthMd,
        overlapRatio: depthOverlapRatio,
      };

      // C. Historical Events Evidence Aggregation
      const totalEvents = candEvents.length;
      const byEventType: Record<string, number> = {};
      const bySeverity: Record<string, number> = {};
      const byReviewStatus: Record<string, number> = {};

      const matchedFormationNames = new Set(
        formationMatches.map((m) => m.formation.trim().toLowerCase()),
      );

      let eventsInOverlappingFormations = 0;
      let eventsInDepthOverlap = 0;

      for (const ev of candEvents) {
        byEventType[ev.eventType] = (byEventType[ev.eventType] ?? 0) + 1;
        bySeverity[ev.severity] = (bySeverity[ev.severity] ?? 0) + 1;
        byReviewStatus[ev.reviewStatus] =
          (byReviewStatus[ev.reviewStatus] ?? 0) + 1;

        if (
          ev.formation &&
          matchedFormationNames.has(ev.formation.trim().toLowerCase())
        ) {
          eventsInOverlappingFormations++;
        }

        if (
          ev.depthMd >= depthOverlapStartMd &&
          ev.depthMd <= depthOverlapEndMd
        ) {
          eventsInDepthOverlap++;
        }
      }

      const historicalEvents: OffsetHistoricalEventsSummary = {
        totalEvents,
        byEventType,
        bySeverity,
        byReviewStatus,
        eventsInOverlappingFormations,
        eventsInDepthOverlap,
      };

      // D. Deterministic Relevance Scoring (Explainable Multi-Factor Heuristic)
      // 1. Spatial proximity factor [0, 1] (weight 0.35)
      const proximityScore = Math.max(
        0,
        Math.min(
          1,
          Math.round((1 - candidate.distanceKm / query.radiusKm) * 1000) / 1000,
        ),
      );

      // 2. Formation overlap factor [0, 1] (weight 0.35)
      const totalRefFormationSpan = refFormations.reduce(
        (sum, f) => sum + Math.max(0, toNum(f.bottomMd) - toNum(f.topMd)),
        0,
      );
      const totalMatchedOverlapSpan = formationMatches.reduce(
        (sum, m) => sum + m.overlapLengthMd,
        0,
      );
      const formationOverlapScore =
        refFormations.length > 0
          ? totalRefFormationSpan > 0
            ? Math.min(
                1,
                Math.round(
                  (totalMatchedOverlapSpan / totalRefFormationSpan) * 1000,
                ) / 1000,
              )
            : 0
          : 0.5; // Neutral baseline when reference well has no formations logged

      // 3. Depth interval overlap factor [0, 1] (weight 0.20)
      const depthOverlapScore = depthOverlapRatio;

      // 4. Historical event evidence density [0, 1] (weight 0.10)
      const eventDensityRaw =
        (totalEvents * 0.5 +
          eventsInOverlappingFormations * 0.3 +
          eventsInDepthOverlap * 0.2) /
        4;
      const eventRelevanceScore = Math.min(
        1,
        Math.round(eventDensityRaw * 1000) / 1000,
      );

      // Composite deterministic score [0.000, 1.000]
      const compositeScore =
        Math.round(
          (proximityScore * 0.35 +
            formationOverlapScore * 0.35 +
            depthOverlapScore * 0.2 +
            eventRelevanceScore * 0.1) *
            1000,
        ) / 1000;

      const relevanceScore: RelevanceScoreResult = {
        score: compositeScore,
        factors: {
          spatialProximityScore: proximityScore,
          formationOverlapScore,
          depthOverlapScore,
          eventRelevanceScore,
        },
        method: "DETERMINISTIC_MULTI_FACTOR",
        interpretation: `Deterministic relevance ranking derived from spatial proximity (${proximityScore}), formation overlap (${formationOverlapScore}), depth overlap (${depthOverlapScore}), and historical drilling events (${eventRelevanceScore}).`,
      };

      evaluatedItems.push({
        offsetWell: {
          id: candidate.id,
          wellId: candidate.wellId,
          name: candidate.name,
          field: candidate.field,
          status: candidate.status,
          latitude: candidate.latitude,
          longitude: candidate.longitude,
          plannedDepthMd: candidate.plannedDepthMd,
          plannedDepthTvd: candidate.plannedDepthTvd,
          spudDate: candidate.spudDate,
        },
        distanceKm: candidate.distanceKm,
        formationMatches,
        depthOverlap,
        historicalEvents,
        relevanceScore,
      });
    }

    // 5. Apply User-Specified Post-Filters
    let filteredItems = evaluatedItems;

    if (query.formation) {
      const targetFormation = query.formation.trim().toLowerCase();
      filteredItems = filteredItems.filter(
        (item) =>
          item.formationMatches.some((m) =>
            m.formation.toLowerCase().includes(targetFormation),
          ) ||
          (batch.formationsByWellId.get(item.offsetWell.id) ?? []).some((f) =>
            f.name.toLowerCase().includes(targetFormation),
          ),
      );
    }

    if (query.minDepthOverlapMd !== undefined) {
      const minOverlap = query.minDepthOverlapMd;
      filteredItems = filteredItems.filter(
        (item) => item.depthOverlap.overlapLengthMd >= minOverlap,
      );
    }

    if (query.minEvents !== undefined) {
      const minEv = query.minEvents;
      filteredItems = filteredItems.filter(
        (item) => item.historicalEvents.totalEvents >= minEv,
      );
    }

    if (query.eventType) {
      const targetType = query.eventType;
      filteredItems = filteredItems.filter(
        (item) => (item.historicalEvents.byEventType[targetType] ?? 0) > 0,
      );
    }

    if (query.severity) {
      const targetSeverity = query.severity;
      filteredItems = filteredItems.filter(
        (item) => (item.historicalEvents.bySeverity[targetSeverity] ?? 0) > 0,
      );
    }

    // 6. Controlled Sorting
    filteredItems.sort((a, b) => {
      let comparison = 0;
      switch (query.sortBy) {
        case "distance":
          comparison = a.distanceKm - b.distanceKm;
          break;
        case "relevanceScore":
          comparison = a.relevanceScore.score - b.relevanceScore.score;
          break;
        case "overlapLength": {
          const aTotalFormationOverlap = a.formationMatches.reduce(
            (s, m) => s + m.overlapLengthMd,
            0,
          );
          const bTotalFormationOverlap = b.formationMatches.reduce(
            (s, m) => s + m.overlapLengthMd,
            0,
          );
          comparison =
            aTotalFormationOverlap !== bTotalFormationOverlap
              ? aTotalFormationOverlap - bTotalFormationOverlap
              : a.depthOverlap.overlapLengthMd - b.depthOverlap.overlapLengthMd;
          break;
        }
        case "eventCount":
          comparison =
            a.historicalEvents.totalEvents - b.historicalEvents.totalEvents;
          break;
        case "name":
          comparison = a.offsetWell.name.localeCompare(b.offsetWell.name);
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    // 7. Bounded Offset Pagination
    const totalItems = filteredItems.length;
    const totalPages =
      Math.ceil(totalItems / query.pageSize) || (totalItems === 0 ? 0 : 1);
    const startIndex = (query.page - 1) * query.pageSize;
    const paginatedItems = filteredItems.slice(
      startIndex,
      startIndex + query.pageSize,
    );

    return {
      referenceWell: {
        id: refWell.id,
        wellId: refWell.wellId,
        name: refWell.name,
        field: refWell.field,
        status: refWell.status,
        latitude: refWell.latitude,
        longitude: refWell.longitude,
        plannedDepthMd: refPlannedDepthMd,
        plannedDepthTvd: refPlannedDepthTvd,
        formations: refFormations.map((f) => ({
          id: f.id,
          name: f.name,
          topMd: toNum(f.topMd),
          bottomMd: toNum(f.bottomMd),
        })),
      },
      items: paginatedItems,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages,
      },
      query: {
        radiusKm: query.radiusKm,
        sortBy: query.sortBy,
        sortOrder,
        appliedFilters: {
          formation: query.formation,
          minDepthOverlapMd: query.minDepthOverlapMd,
          minEvents: query.minEvents,
          eventType: query.eventType,
          severity: query.severity,
        },
      },
    };
  }
}

export const offsetWellService = new OffsetWellService();
