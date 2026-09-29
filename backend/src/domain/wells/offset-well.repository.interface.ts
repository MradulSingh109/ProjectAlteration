import { FormationEntity } from "./formation.entity";
import { OffsetCandidateWell } from "./offset-well.entity";

/**
 * Candidate offset well with spherical Haversine distance.
 */
export interface OffsetCandidateWithDistance extends OffsetCandidateWell {
  distanceKm: number;
}

/**
 * Raw historical drilling event record for batch aggregation.
 */
export interface RawOffsetEvent {
  wellId: string;
  eventType: string;
  severity: string;
  reviewStatus: string;
  depthMd: number;
  formation: string | null;
}

/**
 * Bulk-loaded candidate data bundle containing candidates, their formations, and events.
 * Eliminates N+1 database queries through batch retrieval.
 */
export interface OffsetCandidateBatchData {
  candidates: OffsetCandidateWithDistance[];
  formationsByWellId: Map<string, FormationEntity[]>;
  eventsByWellId: Map<string, RawOffsetEvent[]>;
}

/**
 * Repository port abstraction for offset well spatial candidate discovery
 * and bulk relational loading.
 */
export interface IOffsetWellRepository {
  findOffsetCandidatesData(
    refLatitude: number,
    refLongitude: number,
    radiusKm: number,
    excludeWellId: string,
    limit?: number,
  ): Promise<OffsetCandidateBatchData>;
}
