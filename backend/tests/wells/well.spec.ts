import { describe, it, expect, vi } from "vitest";
import { WellService } from "@/application/wells/well.service";
import { IWellRepository } from "@/domain/wells/well.repository.interface";
import { WellEntity, WellStatus } from "@/domain/wells/well.entity";
import {
  CreateWellSchema,
  UpdateWellSchema,
} from "@/application/wells/well.dto";
import { AppError } from "@/lib/errors";

function createMockWellRepo(initialWells: WellEntity[] = []): IWellRepository {
  const wells = [...initialWells];

  return {
    create: vi.fn(async (data) => {
      const well: WellEntity = {
        id: `mock-uuid-${wells.length + 1}`,
        wellId: data.wellId,
        name: data.name,
        field: data.field,
        latitude: data.latitude,
        longitude: data.longitude,
        spudDate: data.spudDate ?? null,
        plannedDepthMd: data.plannedDepthMd,
        plannedDepthTvd: data.plannedDepthTvd,
        status: data.status ?? "PLANNED",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      wells.push(well);
      return well;
    }),
    findById: vi.fn(async (id: string) => {
      return wells.find((w) => w.id === id) ?? null;
    }),
    findByWellId: vi.fn(async (wellId: string) => {
      return wells.find((w) => w.wellId === wellId) ?? null;
    }),
    list: vi.fn(async (filter) => {
      return wells.filter((w) => {
        if (filter?.field && w.field !== filter.field) return false;
        if (filter?.status && w.status !== filter.status) return false;
        return true;
      });
    }),

    update: vi.fn(async (id, data) => {
      const idx = wells.findIndex((w) => w.id === id);
      if (idx === -1) throw new Error("Well not found");
      const updated: WellEntity = {
        ...wells[idx],
        ...data,
        updatedAt: new Date(),
      };
      wells[idx] = updated;
      return updated;
    }),
    findNearby: vi.fn(async () => []),
  };
}

describe("Well Domain Service & DTO Validation", () => {
  const baseWellData = {
    wellId: "MH-NORTH-01",
    name: "Mumbai High North 01",
    field: "Mumbai High Offshore",
    latitude: 19.418,
    longitude: 71.332,
    plannedDepthMd: 3200.5,
    plannedDepthTvd: 2850.0,
    status: "PLANNED" as WellStatus,
  };

  describe("Validation Schema (CreateWellSchema & UpdateWellSchema)", () => {
    it("validates and parses valid well creation input", () => {
      const parsed = CreateWellSchema.parse({
        ...baseWellData,
        spudDate: "2026-10-15T00:00:00Z",
      });
      expect(parsed.wellId).toBe("MH-NORTH-01");
      expect(parsed.name).toBe("Mumbai High North 01");
      expect(parsed.latitude).toBe(19.418);
      expect(parsed.longitude).toBe(71.332);
      expect(parsed.status).toBe("PLANNED");
      expect(parsed.spudDate).toBeInstanceOf(Date);
    });

    it("rejects invalid latitude (< -90 or > 90)", () => {
      expect(() =>
        CreateWellSchema.parse({
          ...baseWellData,
          latitude: 95.5,
        }),
      ).toThrow();

      expect(() =>
        CreateWellSchema.parse({
          ...baseWellData,
          latitude: -91.0,
        }),
      ).toThrow();
    });

    it("rejects invalid longitude (< -180 or > 180)", () => {
      expect(() =>
        CreateWellSchema.parse({
          ...baseWellData,
          longitude: 185.0,
        }),
      ).toThrow();

      expect(() =>
        CreateWellSchema.parse({
          ...baseWellData,
          longitude: -180.5,
        }),
      ).toThrow();
    });

    it("rejects negative planned depths (MD and TVD)", () => {
      expect(() =>
        CreateWellSchema.parse({
          ...baseWellData,
          plannedDepthMd: -100,
        }),
      ).toThrow();

      expect(() =>
        CreateWellSchema.parse({
          ...baseWellData,
          plannedDepthTvd: -50,
        }),
      ).toThrow();
    });

    it("rejects invalid well status", () => {
      expect(() =>
        CreateWellSchema.parse({
          ...baseWellData,
          status: "UNKNOWN_STATUS" as unknown as WellStatus,
        }),
      ).toThrow();
    });

    it("validates update well schema rejecting negative depth", () => {
      expect(() =>
        UpdateWellSchema.parse({
          plannedDepthMd: -10,
        }),
      ).toThrow();
    });
  });

  describe("Well Application Service Logic", () => {
    it("successfully creates a new well master record", async () => {
      const repo = createMockWellRepo([]);
      const service = new WellService(repo);

      const created = await service.createWell(baseWellData);

      expect(created.id).toBeDefined();
      expect(created.wellId).toBe("MH-NORTH-01");
      expect(created.field).toBe("Mumbai High Offshore");
      expect(created.status).toBe("PLANNED");
      expect(repo.create).toHaveBeenCalledTimes(1);
    });

    it("rejects duplicate Well ID with CONFLICT (409) error", async () => {
      const existingWell: WellEntity = {
        id: "existing-uuid-1",
        wellId: "MH-NORTH-01",
        name: "Existing Well",
        field: "Mumbai High Offshore",
        latitude: 19.418,
        longitude: 71.332,
        spudDate: null,
        plannedDepthMd: 3000,
        plannedDepthTvd: 2700,
        status: "PLANNED",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const repo = createMockWellRepo([existingWell]);
      const service = new WellService(repo);

      try {
        await service.createWell(baseWellData);
        expect.unreachable("Should have thrown CONFLICT error");
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.statusCode).toBe(409);
        expect(appErr.code).toBe("CONFLICT");
        expect(appErr.message).toContain("already exists");
      }
    });

    it("retrieves a well by internal UUID", async () => {
      const existingWell: WellEntity = {
        id: "target-uuid-123",
        wellId: "MH-NORTH-02",
        name: "Mumbai High North 02",
        field: "Mumbai High Offshore",
        latitude: 19.42,
        longitude: 71.335,
        spudDate: null,
        plannedDepthMd: 3100,
        plannedDepthTvd: 2800,
        status: "DRILLING",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const repo = createMockWellRepo([existingWell]);
      const service = new WellService(repo);

      const result = await service.getWell("target-uuid-123");
      expect(result.id).toBe("target-uuid-123");
      expect(result.wellId).toBe("MH-NORTH-02");
      expect(result.status).toBe("DRILLING");
    });

    it("throws NOT_FOUND (404) when retrieving unknown well", async () => {
      const repo = createMockWellRepo([]);
      const service = new WellService(repo);

      try {
        await service.getWell("non-existent-uuid");
        expect.unreachable("Should have thrown NOT_FOUND error");
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.statusCode).toBe(404);
        expect(appErr.code).toBe("NOT_FOUND");
      }
    });

    it("successfully updates well attributes", async () => {
      const existingWell: WellEntity = {
        id: "target-uuid-123",
        wellId: "MH-NORTH-02",
        name: "Mumbai High North 02",
        field: "Mumbai High Offshore",
        latitude: 19.42,
        longitude: 71.335,
        spudDate: null,
        plannedDepthMd: 3100,
        plannedDepthTvd: 2800,
        status: "DRILLING",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const repo = createMockWellRepo([existingWell]);
      const service = new WellService(repo);

      const updated = await service.updateWell("target-uuid-123", {
        status: "COMPLETED",
        plannedDepthMd: 3350,
      });

      expect(updated.status).toBe("COMPLETED");
      expect(updated.plannedDepthMd).toBe(3350);
      expect(repo.update).toHaveBeenCalledWith("target-uuid-123", {
        status: "COMPLETED",
        plannedDepthMd: 3350,
      });
    });

    it("throws NOT_FOUND (404) when updating non-existent well", async () => {
      const repo = createMockWellRepo([]);
      const service = new WellService(repo);

      try {
        await service.updateWell("non-existent-uuid", { status: "COMPLETED" });
        expect.unreachable("Should have thrown NOT_FOUND error");
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.statusCode).toBe(404);
        expect(appErr.code).toBe("NOT_FOUND");
      }
    });
  });
});
