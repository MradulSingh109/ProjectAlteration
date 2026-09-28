import { IWellRepository } from "@/domain/wells/well.repository.interface";
import { wellRepository as defaultWellRepo } from "@/infrastructure/wells/prisma-well.repository";
import {
  WellEntity,
  WellStatus,
  NearbyWellResult,
} from "@/domain/wells/well.entity";
import { FormationEntity } from "@/domain/wells/formation.entity";
import { AppError } from "@/lib/errors";
import {
  CreateWellSchema,
  CreateWellInput,
  UpdateWellSchema,
  UpdateWellInput,
  NearbyWellQuerySchema,
  NearbyWellQuery,
} from "./well.dto";

export class WellService {
  constructor(private readonly repo: IWellRepository = defaultWellRepo) {}

  /**
   * Creates a new well master record.
   * Enforces business wellId uniqueness and coordinate bounds.
   */
  async createWell(input: CreateWellInput | unknown): Promise<WellEntity> {
    const validated = CreateWellSchema.parse(input);

    const existing = await this.repo.findByWellId(validated.wellId);
    if (existing) {
      throw AppError.conflict(
        `Well with identifier '${validated.wellId}' already exists`,
      );
    }

    return this.repo.create({
      wellId: validated.wellId,
      name: validated.name,
      field: validated.field,
      latitude: validated.latitude,
      longitude: validated.longitude,
      spudDate: validated.spudDate,
      plannedDepthMd: validated.plannedDepthMd,
      plannedDepthTvd: validated.plannedDepthTvd,
      status: validated.status as WellStatus,
    });
  }

  /**
   * Retrieves a list of wells matching optional filters.
   */
  async listWells(filter?: {
    field?: string;
    status?: WellStatus;
    limit?: number;
    offset?: number;
  }): Promise<WellEntity[]> {
    return this.repo.list(filter);
  }

  /**
   * Retrieves a single well by internal UUID or unique business wellId.
   */
  async getWell(
    idOrWellId: string,
  ): Promise<WellEntity & { formations?: FormationEntity[] }> {
    if (!idOrWellId || !idOrWellId.trim()) {
      throw AppError.badRequest("Well identifier is required");
    }

    // Try primary UUID lookup first
    let well = await this.repo.findById(idOrWellId);
    if (!well) {
      // Fallback to business wellId
      well = await this.repo.findByWellId(idOrWellId);
    }

    if (!well) {
      throw AppError.notFound(`Well '${idOrWellId}' not found`);
    }

    return well;
  }

  /**
   * Updates an existing well.
   */
  async updateWell(
    idOrWellId: string,
    input: UpdateWellInput | unknown,
  ): Promise<WellEntity> {
    const validated = UpdateWellSchema.parse(input);
    const existing = await this.getWell(idOrWellId);

    return this.repo.update(existing.id, validated);
  }

  /**
   * Searches for nearby offset wells within requested radius (1 km to 50 km).
   */
  async findNearbyWells(
    query: NearbyWellQuery | unknown,
  ): Promise<NearbyWellResult[]> {
    const validated = NearbyWellQuerySchema.parse(query);

    const results = await this.repo.findNearby(
      validated.latitude,
      validated.longitude,
      validated.radiusKm,
      validated.limit,
    );

    return results.sort((a, b) => a.distanceKm - b.distanceKm);
  }
}

export const wellService = new WellService();
