import { prisma } from "@/infrastructure/database/prisma";
import { IWellRepository } from "@/domain/wells/well.repository.interface";
import {
  WellEntity,
  WellStatus,
  NearbyWellResult,
} from "@/domain/wells/well.entity";
import { FormationEntity } from "@/domain/wells/formation.entity";
import {
  Prisma,
  PrismaClient,
  WellStatus as PrismaWellStatus,
} from "@prisma/client";

function mapWell(row: any): WellEntity & { formations?: FormationEntity[] } {
  return {
    id: row.id,
    wellId: row.wellId,
    name: row.name,
    field: row.field,
    latitude: row.latitude,
    longitude: row.longitude,
    spudDate: row.spudDate,
    plannedDepthMd:
      row.plannedDepthMd &&
      typeof row.plannedDepthMd === "object" &&
      "toNumber" in row.plannedDepthMd
        ? row.plannedDepthMd.toNumber()
        : row.plannedDepthMd,
    plannedDepthTvd:
      row.plannedDepthTvd &&
      typeof row.plannedDepthTvd === "object" &&
      "toNumber" in row.plannedDepthTvd
        ? row.plannedDepthTvd.toNumber()
        : row.plannedDepthTvd,
    status: row.status as WellStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...(row.formations
      ? {
          formations: row.formations.map((f: any) => ({
            id: f.id,
            wellId: f.wellId,
            name: f.name,
            topMd:
              f.topMd && typeof f.topMd === "object" && "toNumber" in f.topMd
                ? f.topMd.toNumber()
                : f.topMd,
            bottomMd:
              f.bottomMd &&
              typeof f.bottomMd === "object" &&
              "toNumber" in f.bottomMd
                ? f.bottomMd.toNumber()
                : f.bottomMd,
            lithology: f.lithology,
            createdAt: f.createdAt,
            updatedAt: f.updatedAt,
          })),
        }
      : {}),
  };
}

export class PrismaWellRepository implements IWellRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async create(
    data: Omit<WellEntity, "id" | "createdAt" | "updatedAt">,
  ): Promise<WellEntity> {
    const well = await this.db.well.create({
      data: {
        wellId: data.wellId,
        name: data.name,
        field: data.field,
        latitude: data.latitude,
        longitude: data.longitude,
        spudDate: data.spudDate,
        plannedDepthMd: new Prisma.Decimal(data.plannedDepthMd.toString()),
        plannedDepthTvd: new Prisma.Decimal(data.plannedDepthTvd.toString()),
        status: data.status as PrismaWellStatus,
      },
    });
    return mapWell(well);
  }

  async findById(
    id: string,
  ): Promise<(WellEntity & { formations?: FormationEntity[] }) | null> {
    const well = await this.db.well.findUnique({
      where: { id },
      include: {
        formations: {
          orderBy: { topMd: "asc" },
        },
      },
    });
    return well ? mapWell(well) : null;
  }

  async findByWellId(
    wellId: string,
  ): Promise<(WellEntity & { formations?: FormationEntity[] }) | null> {
    const well = await this.db.well.findUnique({
      where: { wellId },
      include: {
        formations: {
          orderBy: { topMd: "asc" },
        },
      },
    });
    return well ? mapWell(well) : null;
  }

  async list(filter?: {
    field?: string;
    status?: WellStatus;
    limit?: number;
    offset?: number;
  }): Promise<WellEntity[]> {
    const wells = await this.db.well.findMany({
      where: {
        ...(filter?.field
          ? { field: { equals: filter.field, mode: "insensitive" } }
          : {}),
        ...(filter?.status
          ? { status: filter.status as PrismaWellStatus }
          : {}),
      },
      take: filter?.limit ?? 100,
      skip: filter?.offset ?? 0,
      orderBy: { createdAt: "desc" },
    });
    return wells.map(mapWell);
  }

  async update(
    id: string,
    data: Partial<
      Omit<WellEntity, "id" | "wellId" | "createdAt" | "updatedAt">
    >,
  ): Promise<WellEntity> {
    const well = await this.db.well.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.field !== undefined ? { field: data.field } : {}),
        ...(data.latitude !== undefined ? { latitude: data.latitude } : {}),
        ...(data.longitude !== undefined ? { longitude: data.longitude } : {}),
        ...(data.spudDate !== undefined ? { spudDate: data.spudDate } : {}),
        ...(data.plannedDepthMd !== undefined
          ? {
              plannedDepthMd: new Prisma.Decimal(
                data.plannedDepthMd.toString(),
              ),
            }
          : {}),
        ...(data.plannedDepthTvd !== undefined
          ? {
              plannedDepthTvd: new Prisma.Decimal(
                data.plannedDepthTvd.toString(),
              ),
            }
          : {}),
        ...(data.status !== undefined
          ? { status: data.status as PrismaWellStatus }
          : {}),
      },
    });
    return mapWell(well);
  }

  /**
   * Spatial proximity search using spherical Haversine distance approximation
   * with composite B-tree index prefiltering.
   *
   * Engineering Note on Spatial Strategy:
   * - Uses WGS-84 geographic coordinates (latitude, longitude) with a spherical Earth
   *   model (mean volumetric radius R = 6371.0088 km).
   * - Haversine provides an efficient approximation of great-circle distance and is suitable
   *   for operational offset-well proximity searches (<= 50 km). It is not an ellipsoidal
   *   geodesic calculation.
   * - The composite B-tree index on (latitude, longitude) supports database-side candidate
   *   filtering, with latitude serving as the leading range condition and longitude providing
   *   additional filtering. It is not a 2D spatial index (such as PostGIS GiST/R-tree).
   * - Candidate wells passing the bounding box are filtered by exact spherical Haversine
   *   distance and returned in ascending distance order.
   *
   * Geographic Edge Cases:
   * - Extreme Latitudes (|latitude| >= 89.0): Lines of longitude converge at the poles.
   *   To prevent division-by-zero or excessively large longitude deltas, the longitude prefilter
   *   is relaxed across the full [-180, 180] span when approaching the poles.
   * - Antimeridian Wraparound (near +/-180 longitude): When the search radius extends across
   *   the 180th meridian, the longitude prefilter is split into two intervals (e.g. [minLon, 180]
   *   and [-180, wrappedMax]) so nearby offset wells across the antimeridian are not falsely excluded.
   */
  async findNearby(
    latitude: number,
    longitude: number,
    radiusKm: number,
    limit: number = 50,
  ): Promise<NearbyWellResult[]> {
    // 1. Calculate latitude bounding box
    const deltaLat = radiusKm / 111.32;
    const minLat = Math.max(-90, latitude - deltaLat);
    const maxLat = Math.min(90, latitude + deltaLat);

    // 2. Calculate longitude delta with pole convergence guard
    const cosLat = Math.cos((latitude * Math.PI) / 180);
    const isNearPole = Math.abs(latitude) >= 89.0 || cosLat < 0.0175;
    const deltaLon = isNearPole ? 180 : radiusKm / (111.32 * cosLat);

    // 3. Construct parameterized longitude filter handling antimeridian wraparound
    let lonFilter: Prisma.Sql;
    if (deltaLon >= 180 || isNearPole) {
      // Covers all longitudes; no prefiltering on longitude needed
      lonFilter = Prisma.sql`TRUE`;
    } else if (longitude + deltaLon > 180) {
      // Crosses +180 into negative longitudes
      const minLon = longitude - deltaLon;
      const wrappedMax = longitude + deltaLon - 360;
      lonFilter = Prisma.sql`(longitude >= ${minLon}::double precision OR longitude <= ${wrappedMax}::double precision)`;
    } else if (longitude - deltaLon < -180) {
      // Crosses -180 into positive longitudes
      const maxLon = longitude + deltaLon;
      const wrappedMin = longitude - deltaLon + 360;
      lonFilter = Prisma.sql`(longitude <= ${maxLon}::double precision OR longitude >= ${wrappedMin}::double precision)`;
    } else {
      // Standard bounding box within [-180, +180]
      const minLon = longitude - deltaLon;
      const maxLon = longitude + deltaLon;
      lonFilter = Prisma.sql`(longitude BETWEEN ${minLon}::double precision AND ${maxLon}::double precision)`;
    }

    // 4. Parameterized query executing candidate prefilter -> Haversine calculation -> radius check -> distance sort
    const rows = await this.db.$queryRaw<
      Array<{
        id: string;
        wellId: string;
        name: string;
        field: string;
        latitude: number;
        longitude: number;
        status: string;
        distanceKm: number;
      }>
    >`
      SELECT 
        id,
        well_id as "wellId",
        name,
        field,
        latitude,
        longitude,
        status,
        (
          6371.0088 * 2 * ASIN(
            SQRT(
              POWER(SIN(RADIANS((latitude - ${latitude}::double precision) / 2)), 2) +
              COS(RADIANS(${latitude}::double precision)) * COS(RADIANS(latitude)) *
              POWER(SIN(RADIANS((longitude - ${longitude}::double precision) / 2)), 2)
            )
          )
        ) AS "distanceKm"
      FROM wells
      WHERE latitude BETWEEN ${minLat}::double precision AND ${maxLat}::double precision
        AND ${lonFilter}
        AND (
          6371.0088 * 2 * ASIN(
            SQRT(
              POWER(SIN(RADIANS((latitude - ${latitude}::double precision) / 2)), 2) +
              COS(RADIANS(${latitude}::double precision)) * COS(RADIANS(latitude)) *
              POWER(SIN(RADIANS((longitude - ${longitude}::double precision) / 2)), 2)
            )
          )
        ) <= ${radiusKm}::double precision
      ORDER BY "distanceKm" ASC
      LIMIT ${limit}::integer;
    `;

    return rows.map((r) => ({
      id: r.id,
      wellId: r.wellId,
      name: r.name,
      field: r.field,
      latitude: r.latitude,
      longitude: r.longitude,
      status: r.status as WellStatus,
      distanceKm: Math.round(r.distanceKm * 100) / 100,
    }));
  }
}

export const wellRepository = new PrismaWellRepository();
