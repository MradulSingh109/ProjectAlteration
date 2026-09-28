import { describe, it, expect, vi } from "vitest";
import { FormationService } from "@/application/wells/formation.service";
import { IFormationRepository } from "@/domain/wells/formation.repository.interface";
import { IWellRepository } from "@/domain/wells/well.repository.interface";
import { FormationEntity } from "@/domain/wells/formation.entity";
import { WellEntity } from "@/domain/wells/well.entity";
import {
  CreateFormationSchema,
  UpdateFormationSchema,
} from "@/application/wells/well.dto";
import { AppError } from "@/lib/errors";

import { WellService } from "@/application/wells/well.service";

function createMockWellRepo(wells: WellEntity[]): IWellRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(
      async (id: string) => wells.find((w) => w.id === id) ?? null,
    ),
    findByWellId: vi.fn(
      async (wellId: string) => wells.find((w) => w.wellId === wellId) ?? null,
    ),
    list: vi.fn(async () => wells),
    update: vi.fn(),
    findNearby: vi.fn(async () => []),
  };
}

function createMockFormationRepo(
  initialFormations: FormationEntity[] = [],
): IFormationRepository {
  const formations = [...initialFormations];

  return {
    create: vi.fn(async (data) => {
      const f: FormationEntity = {
        id: `form-uuid-${formations.length + 1}`,
        wellId: data.wellId,
        name: data.name,
        topMd: data.topMd,
        bottomMd: data.bottomMd,
        lithology: data.lithology ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      formations.push(f);
      return f;
    }),
    findById: vi.fn(
      async (id: string) => formations.find((f) => f.id === id) ?? null,
    ),
    listByWellId: vi.fn(async (wellId: string) =>
      formations.filter((f) => f.wellId === wellId),
    ),
    update: vi.fn(async (id, data) => {
      const idx = formations.findIndex((f) => f.id === id);
      if (idx === -1) throw new Error("Formation not found");
      const updated: FormationEntity = {
        ...formations[idx],
        ...data,
        updatedAt: new Date(),
      };
      formations[idx] = updated;
      return updated;
    }),
  };
}

describe("Formation Domain Service & Interval Validation", () => {
  const sampleWell: WellEntity = {
    id: "well-uuid-1",
    wellId: "MH-01",
    name: "Mumbai High Alpha",
    field: "Mumbai High",
    latitude: 19.418,
    longitude: 71.332,
    spudDate: null,
    plannedDepthMd: 3000,
    plannedDepthTvd: 2800,
    status: "DRILLING",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe("Validation Schema (CreateFormationSchema & UpdateFormationSchema)", () => {
    it("validates valid formation input", () => {
      const valid = CreateFormationSchema.parse({
        name: "Bassein Limestone",
        topMd: 1850.5,
        bottomMd: 2150.0,
        lithology: "Limestone",
      });
      expect(valid.name).toBe("Bassein Limestone");
      expect(valid.topMd).toBe(1850.5);
      expect(valid.bottomMd).toBe(2150.0);
      expect(valid.lithology).toBe("Limestone");
    });

    it("rejects negative topMd", () => {
      expect(() =>
        CreateFormationSchema.parse({
          name: "Fault Zone",
          topMd: -100,
          bottomMd: 500,
        }),
      ).toThrow();
    });

    it("rejects negative bottomMd", () => {
      expect(() =>
        CreateFormationSchema.parse({
          name: "Fault Zone",
          topMd: 0,
          bottomMd: -50,
        }),
      ).toThrow();
    });

    it("rejects invalid interval where bottomMd is strictly less than topMd", () => {
      expect(() =>
        CreateFormationSchema.parse({
          name: "Inverted Interval",
          topMd: 2500,
          bottomMd: 2400, // Invalid!
        }),
      ).toThrow();
    });

    it("allows zero-thickness boundary interval where bottomMd equals topMd", () => {
      const boundary = CreateFormationSchema.parse({
        name: "Marker Horizon",
        topMd: 2000,
        bottomMd: 2000,
      });
      expect(boundary.topMd).toBe(2000);
      expect(boundary.bottomMd).toBe(2000);
    });

    it("rejects empty formation name", () => {
      expect(() =>
        CreateFormationSchema.parse({
          name: "",
          topMd: 1000,
          bottomMd: 1200,
        }),
      ).toThrow();
    });

    it("rejects inverted interval during update schema validation", () => {
      expect(() =>
        UpdateFormationSchema.parse({
          topMd: 2000,
          bottomMd: 1900,
        }),
      ).toThrow();
    });
  });

  describe("Formation Application Service Logic", () => {
    it("successfully creates a formation associated with an existing well", async () => {
      const wellRepo = createMockWellRepo([sampleWell]);
      const wellService = new WellService(wellRepo);
      const formationRepo = createMockFormationRepo([]);
      const service = new FormationService(formationRepo, wellService);

      const created = await service.createFormation("well-uuid-1", {
        name: "Mukta Formation",
        topMd: 1200,
        bottomMd: 1550,
        lithology: "Shale / Carbonate",
      });

      expect(created.id).toBeDefined();
      expect(created.wellId).toBe("well-uuid-1");
      expect(created.name).toBe("Mukta Formation");
      expect(formationRepo.create).toHaveBeenCalledTimes(1);
    });

    it("throws NOT_FOUND (404) when creating a formation for non-existent well", async () => {
      const wellRepo = createMockWellRepo([]); // Empty well repo
      const wellService = new WellService(wellRepo);
      const formationRepo = createMockFormationRepo([]);
      const service = new FormationService(formationRepo, wellService);

      try {
        await service.createFormation("unknown-well-uuid", {
          name: "Mukta Formation",
          topMd: 1200,
          bottomMd: 1550,
        });
        expect.unreachable("Should have thrown NOT_FOUND error");
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.statusCode).toBe(404);
        expect(appErr.code).toBe("NOT_FOUND");
        expect(appErr.message).toContain("not found");
      }
    });

    it("retrieves formations belonging strictly to the requested well", async () => {
      const form1: FormationEntity = {
        id: "form-1",
        wellId: "well-uuid-1",
        name: "Layer 1",
        topMd: 100,
        bottomMd: 500,
        lithology: "Sandstone",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const form2: FormationEntity = {
        id: "form-2",
        wellId: "different-well-uuid",
        name: "Other Well Layer",
        topMd: 200,
        bottomMd: 600,
        lithology: "Clay",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const wellRepo = createMockWellRepo([sampleWell]);
      const wellService = new WellService(wellRepo);
      const formationRepo = createMockFormationRepo([form1, form2]);
      const service = new FormationService(formationRepo, wellService);

      const results = await service.listFormations("well-uuid-1");
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("form-1");
      expect(results[0].name).toBe("Layer 1");
    });

    it("rejects modifying a formation through a mismatched well route (cross-well isolation protection)", async () => {
      const foreignFormation: FormationEntity = {
        id: "form-foreign-99",
        wellId: "actual-parent-well-uuid", // belongs to a different well
        name: "Panna Formation",
        topMd: 2200,
        bottomMd: 2600,
        lithology: "Sandstone",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const wellRepo = createMockWellRepo([sampleWell]);
      const wellService = new WellService(wellRepo);
      const formationRepo = createMockFormationRepo([foreignFormation]);
      const service = new FormationService(formationRepo, wellService);

      // Attempting to update foreignFormation under route /wells/well-uuid-1/formations/form-foreign-99
      try {
        await service.updateFormation("well-uuid-1", "form-foreign-99", {
          name: "Attempted Tampered Name",
        });
        expect.unreachable("Should have prevented cross-well modification");
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.statusCode).toBe(404);
        expect(appErr.code).toBe("NOT_FOUND");
        expect(appErr.message).toContain("does not belong to well");
      }
    });

    it("successfully updates formation when route wellId matches formation parent well", async () => {
      const targetFormation: FormationEntity = {
        id: "form-1",
        wellId: "well-uuid-1",
        name: "Layer 1",
        topMd: 100,
        bottomMd: 500,
        lithology: "Sandstone",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const wellRepo = createMockWellRepo([sampleWell]);
      const wellService = new WellService(wellRepo);
      const formationRepo = createMockFormationRepo([targetFormation]);
      const service = new FormationService(formationRepo, wellService);

      const updated = await service.updateFormation("well-uuid-1", "form-1", {
        bottomMd: 550,
        lithology: "Fine Sandstone",
      });

      expect(updated.bottomMd).toBe(550);
      expect(updated.lithology).toBe("Fine Sandstone");
      expect(formationRepo.update).toHaveBeenCalledWith("form-1", {
        bottomMd: 550,
        lithology: "Fine Sandstone",
      });
    });
  });
});
