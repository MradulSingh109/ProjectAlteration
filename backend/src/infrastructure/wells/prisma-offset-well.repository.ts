import { prisma } from "@/infrastructure/database/prisma";
import {
  IOffsetWellRepository,
  OffsetCandidateBatchData,
  OffsetCandidateWithDistance,
  RawOffsetEvent,
} from "@/domain/wells/offset-well.repository.interface";
import { WellStatus } from "@/domain/wells/well.entity";
import { FormationEntity } from "@/domain/wells/formation.entity";
import { Prisma, PrismaClient } from "@prisma/client";

export class PrismaOffsetWellRepository implements IOffsetWellRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  /**
   * Discovers candidate offset wells using spherical Haversine distance with B-tree index prefiltering,
   * excluding the reference well, and bulk-loading formations and drilling events.
   *
   * Spatial Strategy:
   * - Uses WGS-84 geographic coordinates (latitude, longitude) with a spherical Earth model (R = 6371.0088 km).
   * - Applies bounding box prefilter on (latitude, longitude).
   * - Polar guard relaxes longitude range when |latitude| >= 89.0 to prevent pole convergence errors.
   * - Antimeridian wraparound splits longitude conditions across the +/- 180th meridian.
   * - Batch relational loading executes in O(1) database round trips, eliminating N+1 overhead.
   */
  async findOffsetCandidatesData(
    refLatitude: number,
    refLongitude: number,
    radiusKm: number,
    excludeWellId: string,
    limit: number = 200,
  ): Promise<OffsetCandidateBatchData> {
    // 1. Calculate latitude bounding box
    const deltaLat = radiusKm / 111.32;
    const minLat = Math.max(-90, refLatitude - deltaLat);
    const maxLat = Math.min(90, refLatitude + deltaLat);

    // 2. Calculate longitude delta with polar convergence guard
    const cosLat = Math.cos((refLatitude * Math.PI) / 180);
    const isNearPole = Math.abs(refLatitude) >= 89.0 || cosLat < 0.0175;
    const deltaLon = isNearPole ? 180 : radiusKm / (111.32 * cosLat);

    // 3. Parameterized longitude filter handling antimeridian wraparound
    let lonFilter: ReturnType<typeof Prisma.sql>;
    if (deltaLon >= 180 || isNearPole) {
      lonFilter = Prisma.sql`TRUE`;
    } else if (refLongitude + deltaLon > 180) {
      const minLon = refLongitude - deltaLon;
      const wrappedMax = refLongitude + deltaLon - 360;
      lonFilter = Prisma.sql`(longitude >= ${minLon}::double precision OR longitude <= ${wrappedMax}::double precision)`;
    } else if (refLongitude - deltaLon < -180) {
      const maxLon = refLongitude + deltaLon;
      const wrappedMin = refLongitude - deltaLon + 360;
      lonFilter = Prisma.sql`(longitude <= ${maxLon}::double precision OR longitude >= ${wrappedMin}::double precision)`;
    } else {
      const minLon = refLongitude - deltaLon;
      const maxLon = refLongitude + deltaLon;
      lonFilter = Prisma.sql`(longitude BETWEEN ${minLon}::double precision AND ${maxLon}::double precision)`;
    }

    type RawCandidateRow = {
      id: string;
      wellId: string;
      name: string;
      field: string;
      status: string;
      latitude: number;
      longitude: number;
      plannedDepthMd: unknown;
      plannedDepthTvd: unknown;
      spudDate: Date | null;
      distanceKm: number;
    };

    // 4. Parameterized query executing bounding-box prefilter -> exact Haversine -> radius threshold -> distance sort
    const rows = await this.db.$queryRaw<RawCandidateRow[]>`
      SELECT 
        id,
        well_id as "wellId",
        name,
        field,
        status,
        latitude,
        longitude,
        planned_depth_md as "plannedDepthMd",
        planned_depth_tvd as "plannedDepthTvd",
        spud_date as "spudDate",
        (
          6371.0088 * 2 * ASIN(
            SQRT(
              POWER(SIN(RADIANS((latitude - ${refLatitude}::double precision) / 2)), 2) +
              COS(RADIANS(${refLatitude}::double precision)) * COS(RADIANS(latitude)) *
              POWER(SIN(RADIANS((longitude - ${refLongitude}::double precision) / 2)), 2)
            )
          )
        ) AS "distanceKm"
      FROM wells
      WHERE id != ${excludeWellId}
        AND latitude BETWEEN ${minLat}::double precision AND ${maxLat}::double precision
        AND ${lonFilter}
        AND (
          6371.0088 * 2 * ASIN(
            SQRT(
              POWER(SIN(RADIANS((latitude - ${refLatitude}::double precision) / 2)), 2) +
              COS(RADIANS(${refLatitude}::double precision)) * COS(RADIANS(latitude)) *
              POWER(SIN(RADIANS((longitude - ${refLongitude}::double precision) / 2)), 2)
            )
          )
        ) <= ${radiusKm}::double precision
      ORDER BY "distanceKm" ASC
      LIMIT ${limit}::integer;
    `;

    const candidates: OffsetCandidateWithDistance[] = rows.map((r) => ({
      id: r.id,
      wellId: r.wellId,
      name: r.name,
      field: r.field,
      status: r.status as WellStatus,
      latitude: r.latitude,
      longitude: r.longitude,
      plannedDepthMd:
        r.plannedDepthMd &&
        typeof r.plannedDepthMd === "object" &&
        "toNumber" in r.plannedDepthMd
          ? (r.plannedDepthMd as { toNumber(): number }).toNumber()
          : Number(r.plannedDepthMd || 0),
      plannedDepthTvd:
        r.plannedDepthTvd &&
        typeof r.plannedDepthTvd === "object" &&
        "toNumber" in r.plannedDepthTvd
          ? (r.plannedDepthTvd as { toNumber(): number }).toNumber()
          : Number(r.plannedDepthTvd || 0),
      spudDate: r.spudDate,
      distanceKm: Math.round(r.distanceKm * 100) / 100,
    }));

    if (candidates.length === 0) {
      return {
        candidates: [],
        formationsByWellId: new Map(),
        eventsByWellId: new Map(),
      };
    }

    const candidateIds = candidates.map((c) => c.id);

    // 5. Bulk load formations for all candidate wells in a single indexed query
    const rawFormations = await this.db.formation.findMany({
      where: { wellId: { in: candidateIds } },
      orderBy: { topMd: "asc" },
    });

    const formationsByWellId = new Map<string, FormationEntity[]>();
    for (const f of rawFormations) {
      const entity: FormationEntity = {
        id: f.id,
        wellId: f.wellId,
        name: f.name,
        topMd:
          f.topMd && typeof f.topMd === "object" && "toNumber" in f.topMd
            ? f.topMd.toNumber()
            : Number(f.topMd),
        bottomMd:
          f.bottomMd &&
          typeof f.bottomMd === "object" &&
          "toNumber" in f.bottomMd
            ? f.bottomMd.toNumber()
            : Number(f.bottomMd),
        lithology: f.lithology,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      };
      const list = formationsByWellId.get(f.wellId) ?? [];
      list.push(entity);
      formationsByWellId.set(f.wellId, list);
    }

    // 6. Bulk load drilling events for all candidate wells in a single indexed query
    const rawEvents = await this.db.drillingEvent.findMany({
      where: { wellId: { in: candidateIds } },
      select: {
        wellId: true,
        eventType: true,
        severity: true,
        reviewStatus: true,
        depthMd: true,
        formation: true,
      },
    });

    const eventsByWellId = new Map<string, RawOffsetEvent[]>();
    for (const e of rawEvents) {
      const ev: RawOffsetEvent = {
        wellId: e.wellId,
        eventType: e.eventType,
        severity: e.severity,
        reviewStatus: e.reviewStatus,
        depthMd:
          e.depthMd && typeof e.depthMd === "object" && "toNumber" in e.depthMd
            ? e.depthMd.toNumber()
            : Number(e.depthMd),
        formation: e.formation,
      };
      const list = eventsByWellId.get(e.wellId) ?? [];
      list.push(ev);
      eventsByWellId.set(e.wellId, list);
    }

    return {
      candidates,
      formationsByWellId,
      eventsByWellId,
    };
  }
}

export const offsetWellRepository = new PrismaOffsetWellRepository();
