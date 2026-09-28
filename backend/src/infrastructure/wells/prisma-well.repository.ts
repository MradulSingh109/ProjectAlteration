import { prisma } from "@/infrastructure/database/prisma";
import { IWellRepository } from "@/domain/wells/well.repository.interface";
import {
  WellEntity,
  WellStatus,
  NearbyWellResult,
} from "@/domain/wells/well.entity";
import { FormationEntity } from "@/domain/wells/formation.entity";
import { PrismaClient, WellStatus as PrismaWellStatus } from "@prisma/client";

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
        plannedDepthMd: data.plannedDepthMd,
        plannedDepthTvd: data.plannedDepthTvd,
        status: data.status as PrismaWellStatus,
      },
    });
    return well as unknown as WellEntity;
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
    return (
      (well as unknown as WellEntity & { formations?: FormationEntity[] }) ||
      null
    );
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
    return (
      (well as unknown as WellEntity & { formations?: FormationEntity[] }) ||
      null
    );
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
    return wells as unknown as WellEntity[];
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
          ? { plannedDepthMd: data.plannedDepthMd }
          : {}),
        ...(data.plannedDepthTvd !== undefined
          ? { plannedDepthTvd: data.plannedDepthTvd }
          : {}),
        ...(data.status !== undefined
          ? { status: data.status as PrismaWellStatus }
          : {}),
      },
    });
    return well as unknown as WellEntity;
  }

  /**
   * Spatial proximity search using Great-Circle Haversine calculation
   * with bounding-box prefilter optimization.
   *
   * Security & Performance:
   * - Uses parameterized Prisma SQL tagged template ($1, $2, ... bound variables)
   * - Leverages composite index (latitude, longitude) for bounding-box prefilter
   * - Computes spherical distance in kilometers using WGS-84 mean radius R = 6371.0088 km
   * - Sorts ascending by distance and bounds result count
   */
  async findNearby(
    latitude: number,
    longitude: number,
    radiusKm: number,
    limit: number = 50,
  ): Promise<NearbyWellResult[]> {
    // 1. Calculate bounding box offsets for index prefiltering
    const deltaLat = radiusKm / 111.32;
    const cosLat = Math.cos((latitude * Math.PI) / 180);
    const deltaLon =
      Math.abs(latitude) > 89.9
        ? 180
        : radiusKm / (111.32 * Math.max(cosLat, 0.0001));

    const minLat = Math.max(-90, latitude - deltaLat);
    const maxLat = Math.min(90, latitude + deltaLat);
    const minLon = Math.max(-180, longitude - deltaLon);
    const maxLon = Math.min(180, longitude + deltaLon);

    // 2. Execute parameterized Haversine distance query
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
        AND longitude BETWEEN ${minLon}::double precision AND ${maxLon}::double precision
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
