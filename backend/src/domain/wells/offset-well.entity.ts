import { WellStatus } from "./well.entity";
import { EventType, EventSeverity } from "../events/drilling-event.entity";

/**
 * Depth interval representation in meters measured depth (MD).
 */
export interface DepthInterval {
  topMd: number;
  bottomMd: number;
}

/**
 * Formation stratigraphic overlap match between reference well and offset well.
 */
export interface FormationOverlapMatch {
  formation: string;
  referenceInterval: DepthInterval;
  offsetInterval: DepthInterval;
  overlapStartMd: number;
  overlapEndMd: number;
  overlapLengthMd: number;
}

/**
 * Borehole depth interval overlap analysis.
 */
export interface DepthOverlapAnalysis {
  exists: boolean;
  overlapStartMd: number;
  overlapEndMd: number;
  overlapLengthMd: number;
  overlapRatio: number; // overlapLengthMd / max(refDepth, offsetDepth)
}

/**
 * Aggregated historical drilling events evidence for an offset well.
 */
export interface OffsetHistoricalEventsSummary {
  totalEvents: number;
  byEventType: Record<string, number>;
  bySeverity: Record<string, number>;
  byReviewStatus: Record<string, number>;
  eventsInOverlappingFormations: number;
  eventsInDepthOverlap: number;
}

/**
 * Normalized factor breakdown for the deterministic relevance score.
 * Each factor is bounded in [0.000, 1.000].
 */
export interface RelevanceFactors {
  spatialProximityScore: number; // 1.0 at distance 0, decays to 0.0 at radiusKm (weight: 0.35)
  formationOverlapScore: number; // Fraction of reference formations matched with depth overlap (weight: 0.35)
  depthOverlapScore: number; // Depth interval overlap ratio (weight: 0.20)
  eventRelevanceScore: number; // Historical drilling event evidence density (weight: 0.10)
}

/**
 * Deterministic multi-factor relevance score result.
 */
export interface RelevanceScoreResult {
  score: number; // Composite score in [0.000, 1.000]
  factors: RelevanceFactors;
  method: "DETERMINISTIC_MULTI_FACTOR";
  interpretation: string;
}

/**
 * Candidate offset well summary metadata.
 */
export interface OffsetCandidateWell {
  id: string;
  wellId: string;
  name: string;
  field: string;
  status: WellStatus;
  latitude: number;
  longitude: number;
  plannedDepthMd: number;
  plannedDepthTvd: number;
  spudDate: Date | null;
}

/**
 * A single offset well intelligence item containing all deterministic evidence.
 */
export interface OffsetWellIntelligenceItem {
  offsetWell: OffsetCandidateWell;
  distanceKm: number;
  formationMatches: FormationOverlapMatch[];
  depthOverlap: DepthOverlapAnalysis;
  historicalEvents: OffsetHistoricalEventsSummary;
  relevanceScore: RelevanceScoreResult;
}

/**
 * Supported sort fields for offset well queries.
 */
export type OffsetSortField =
  "distance" | "relevanceScore" | "overlapLength" | "eventCount" | "name";

export type SortOrder = "asc" | "desc";

/**
 * Domain filter criteria for offset well discovery.
 */
export interface OffsetWellSearchCriteria {
  radiusKm?: number;
  formation?: string;
  minDepthOverlapMd?: number;
  minEvents?: number;
  eventType?: EventType;
  severity?: EventSeverity;
  page?: number;
  pageSize?: number;
  sortBy?: OffsetSortField;
  sortOrder?: SortOrder;
}

/**
 * Top-level offset well intelligence query result.
 */
export interface OffsetWellIntelligenceResult {
  referenceWell: {
    id: string;
    wellId: string;
    name: string;
    field: string;
    status: WellStatus;
    latitude: number;
    longitude: number;
    plannedDepthMd: number;
    plannedDepthTvd: number;
    formations: {
      id: string;
      name: string;
      topMd: number;
      bottomMd: number;
    }[];
  };
  items: OffsetWellIntelligenceItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  query: {
    radiusKm: number;
    sortBy: OffsetSortField;
    sortOrder: SortOrder;
    appliedFilters: {
      formation?: string;
      minDepthOverlapMd?: number;
      minEvents?: number;
      eventType?: string;
      severity?: string;
    };
  };
}
