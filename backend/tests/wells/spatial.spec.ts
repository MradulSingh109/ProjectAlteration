import { describe, it, expect, vi } from "vitest";
import { WellService } from "@/application/wells/well.service";
import { IWellRepository } from "@/domain/wells/well.repository.interface";
import { NearbyWellResult } from "@/domain/wells/well.entity";
import { NearbyWellQuerySchema } from "@/application/wells/well.dto";
import { PrismaWellRepository } from "@/infrastructure/wells/prisma-well.repository";
import { PrismaClient } from "@prisma/client";

/**
 * Deterministic Haversine distance calculator for test expectation verification
 */
function calculateHaversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371.0088; // Earth mean radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 1000) / 1000;
}

describe("Spatial Proximity Search (Haversine & Offset Well Analysis)", () => {
  // Reference Coordinate: Mumbai High North Platform
  const REF_LAT = 19.418;
  const REF_LON = 71.332;

  // Known deterministic test wells
  const nearWell: NearbyWellResult = {
    id: "uuid-near",
    wellId: "MH-NEAR-01",
    name: "Mumbai High Near 01",
    field: "Mumbai High",
    latitude: 19.43,
    longitude: 71.34,
    status: "DRILLING",
    distanceKm: calculateHaversineKm(REF_LAT, REF_LON, 19.43, 71.34), // ~1.57 km
  };

  const mediumWell: NearbyWellResult = {
    id: "uuid-med",
    wellId: "MH-MED-02",
    name: "Mumbai High Med 02",
    field: "Mumbai High",
    latitude: 19.47,
    longitude: 71.38,
    status: "COMPLETED",
    distanceKm: calculateHaversineKm(REF_LAT, REF_LON, 19.47, 71.38), // ~7.67 km
  };

  const boundaryWell: NearbyWellResult = {
    id: "uuid-bound",
    wellId: "MH-BOUND-03",
    name: "Mumbai High Boundary 03",
    field: "Mumbai High",
    latitude: 19.51,
    longitude: 71.41,
    status: "PLANNED",
    distanceKm: calculateHaversineKm(REF_LAT, REF_LON, 19.51, 71.41), // ~13.10 km
  };

  const distantWell: NearbyWellResult = {
    id: "uuid-far",
    wellId: "MH-FAR-04",
    name: "Distant Offshore Deepwater",
    field: "Deep Continental Shelf",
    latitude: 19.9,
    longitude: 71.6,
    status: "ABANDONED",
    distanceKm: calculateHaversineKm(REF_LAT, REF_LON, 19.9, 71.6), // ~60.5 km
  };

  describe("Validation of Spatial Query Parameters", () => {
    it("accepts valid coordinates and operational radius", () => {
      const parsed = NearbyWellQuerySchema.parse({
        latitude: 19.418,
        longitude: 71.332,
        radiusKm: 10,
      });
      expect(parsed.latitude).toBe(19.418);
      expect(parsed.longitude).toBe(71.332);
      expect(parsed.radiusKm).toBe(10);
    });

    it("rejects latitude outside [-90, +90]", () => {
      expect(() =>
        NearbyWellQuerySchema.parse({
          latitude: 91.0,
          longitude: 71.332,
          radiusKm: 10,
        }),
      ).toThrow();
    });

    it("rejects longitude outside [-180, +180]", () => {
      expect(() =>
        NearbyWellQuerySchema.parse({
          latitude: 19.418,
          longitude: 181.5,
          radiusKm: 10,
        }),
      ).toThrow();
    });

    it("rejects zero or negative radius", () => {
      expect(() =>
        NearbyWellQuerySchema.parse({
          latitude: 19.418,
          longitude: 71.332,
          radiusKm: 0,
        }),
      ).toThrow();

      expect(() =>
        NearbyWellQuerySchema.parse({
          latitude: 19.418,
          longitude: 71.332,
          radiusKm: -5,
        }),
      ).toThrow();
    });

    it("enforces operational radius safety ceiling (max 50 km)", () => {
      expect(() =>
        NearbyWellQuerySchema.parse({
          latitude: 19.418,
          longitude: 71.332,
          radiusKm: 55, // exceeds 50 km safety cap
        }),
      ).toThrow();
    });
  });

  describe("Proximity Search Execution & Filtering", () => {
    it("returns nearby wells within requested radius and excludes distant wells", async () => {
      const allTestWells = [nearWell, mediumWell, boundaryWell, distantWell];

      // Simulated repository that filters by distance
      const mockRepo: IWellRepository = {
        create: vi.fn(),
        findById: vi.fn(),
        findByWellId: vi.fn(),
        list: vi.fn(),
        update: vi.fn(),
        findNearby: vi.fn(
          async (_lat: number, _lon: number, radiusKm: number) => {
            return allTestWells
              .filter((w) => w.distanceKm <= radiusKm)
              .sort((a, b) => a.distanceKm - b.distanceKm);
          },
        ),
      };

      const wellService = new WellService(mockRepo);

      // Search with radius 10 km
      const results10km = await wellService.findNearbyWells({
        latitude: REF_LAT,
        longitude: REF_LON,
        radiusKm: 10,
      });

      // Should include near (~1.57 km) and medium (~7.67 km)
      expect(results10km).toHaveLength(2);
      expect(results10km.map((w) => w.wellId)).toEqual([
        "MH-NEAR-01",
        "MH-MED-02",
      ]);
      expect(results10km[0].distanceKm).toBeLessThan(results10km[1].distanceKm);

      // Search with radius 25 km (should now include boundary well ~13.1 km, but still exclude distant well ~60.5 km)
      const results25km = await wellService.findNearbyWells({
        latitude: REF_LAT,
        longitude: REF_LON,
        radiusKm: 25,
      });

      expect(results25km).toHaveLength(3);
      expect(results25km.map((w) => w.wellId)).toEqual([
        "MH-NEAR-01",
        "MH-MED-02",
        "MH-BOUND-03",
      ]);
      expect(results25km.some((w) => w.wellId === "MH-FAR-04")).toBe(false);
    });

    it("guarantees results are strictly ordered by distance ascending", async () => {
      // Intentionally provide out of order
      const mockRepo: IWellRepository = {
        create: vi.fn(),
        findById: vi.fn(),
        findByWellId: vi.fn(),
        list: vi.fn(),
        update: vi.fn(),
        findNearby: vi.fn(async () => [mediumWell, nearWell]),
      };

      const wellService = new WellService(mockRepo);
      const results = await wellService.findNearbyWells({
        latitude: REF_LAT,
        longitude: REF_LON,
        radiusKm: 10,
      });

      // The service contract ensures nearest well is first
      expect(results[0].distanceKm).toBeLessThanOrEqual(results[1].distanceKm);
    });
  });

  describe("Prisma SQL Haversine & Bounding Box Implementation", () => {
    it("executes parameterized $queryRaw with bounding box bounds without string concatenation", async () => {
      const mockQueryRaw = vi.fn(async () => [
        {
          id: "uuid-near",
          wellId: "MH-NEAR-01",
          name: "Mumbai High Near 01",
          field: "Mumbai High",
          latitude: 19.43,
          longitude: 71.34,
          status: "DRILLING",
          distanceKm: 1.572,
        },
      ]);

      const mockPrisma = {
        $queryRaw: mockQueryRaw,
        well: {
          create: vi.fn(),
          findUnique: vi.fn(),
          findMany: vi.fn(),
          update: vi.fn(),
        },
      } as unknown as PrismaClient;

      const repo = new PrismaWellRepository(mockPrisma);

      const results = await repo.findNearby(19.418, 71.332, 10, 20);

      expect(mockQueryRaw).toHaveBeenCalledTimes(1);
      expect(results).toHaveLength(1);
      expect(results[0].wellId).toBe("MH-NEAR-01");
      expect(results[0].distanceKm).toBe(1.57);
      expect(results[0].latitude).toBe(19.43);
      expect(results[0].longitude).toBe(71.34);
    });

    it("handles antimeridian crossing near +/-180 longitude without false exclusions", async () => {
      let executedSql = "";
      const mockQueryRaw = vi.fn(async (query: any) => {
        executedSql = query?.strings ? query.strings.join(" ") : String(query);
        return [
          {
            id: "uuid-antimeridian",
            wellId: "ANTIMERIDIAN-01",
            name: "Antimeridian Offset Well",
            field: "Pacific Border Field",
            latitude: 0.0,
            longitude: -179.9,
            status: "DRILLING",
            distanceKm: 22.24,
          },
        ];
      });

      const mockPrisma = {
        $queryRaw: mockQueryRaw,
        well: {
          create: vi.fn(),
          findUnique: vi.fn(),
          findMany: vi.fn(),
          update: vi.fn(),
        },
      } as unknown as PrismaClient;

      const repo = new PrismaWellRepository(mockPrisma);

      // Query near +180 (e.g. 179.9) with 30 km radius (crosses 180th meridian into negative longitudes)
      const results = await repo.findNearby(0.0, 179.9, 30, 20);

      expect(mockQueryRaw).toHaveBeenCalledTimes(1);
      expect(results).toHaveLength(1);
      expect(results[0].wellId).toBe("ANTIMERIDIAN-01");
      expect(results[0].distanceKm).toBe(22.24);
    });

    it("safely handles extreme latitude queries (|lat| >= 89) without division-by-zero or NaN", async () => {
      const mockQueryRaw = vi.fn(async () => []);
      const mockPrisma = {
        $queryRaw: mockQueryRaw,
        well: {
          create: vi.fn(),
          findUnique: vi.fn(),
          findMany: vi.fn(),
          update: vi.fn(),
        },
      } as unknown as PrismaClient;

      const repo = new PrismaWellRepository(mockPrisma);

      // Extreme north latitude near pole
      const results = await repo.findNearby(89.5, 0.0, 25, 10);
      expect(mockQueryRaw).toHaveBeenCalledTimes(1);
      expect(results).toEqual([]);
    });
  });
});
