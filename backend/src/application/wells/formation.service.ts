import { IFormationRepository } from "@/domain/wells/formation.repository.interface";
import { formationRepository as defaultFormationRepo } from "@/infrastructure/wells/prisma-formation.repository";
import { wellService as defaultWellService, WellService } from "./well.service";
import { FormationEntity } from "@/domain/wells/formation.entity";
import { AppError } from "@/lib/errors";
import {
  CreateFormationSchema,
  CreateFormationInput,
  UpdateFormationSchema,
  UpdateFormationInput,
} from "./well.dto";

export class FormationService {
  constructor(
    private readonly repo: IFormationRepository = defaultFormationRepo,
    private readonly wellService: WellService = defaultWellService,
  ) {}

  /**
   * Adds a geological formation record to a well.
   */
  async createFormation(
    wellIdOrBusinessId: string,
    input: CreateFormationInput | unknown,
  ): Promise<FormationEntity> {
    const well = await this.wellService.getWell(wellIdOrBusinessId);
    const validated = CreateFormationSchema.parse(input);

    return this.repo.create({
      wellId: well.id,
      name: validated.name,
      topMd: validated.topMd,
      bottomMd: validated.bottomMd,
      lithology: validated.lithology,
    });
  }

  /**
   * Lists all formations associated with a well in stratigraphic depth order.
   */
  async listFormations(wellIdOrBusinessId: string): Promise<FormationEntity[]> {
    const well = await this.wellService.getWell(wellIdOrBusinessId);
    return this.repo.listByWellId(well.id);
  }

  /**
   * Updates an existing formation record.
   *
   * Security & Integrity:
   * Strictly validates that the route's well matches the formation's actual parent well.
   * Prevents cross-well tampering through forged route parameters.
   */
  async updateFormation(
    wellIdOrBusinessId: string,
    formationId: string,
    input: UpdateFormationInput | unknown,
  ): Promise<FormationEntity> {
    const well = await this.wellService.getWell(wellIdOrBusinessId);
    const formation = await this.repo.findById(formationId);

    if (!formation) {
      throw AppError.notFound(`Formation '${formationId}' not found`);
    }

    // Verify parent-child integrity: formation must belong to this specific well
    if (formation.wellId !== well.id) {
      throw AppError.notFound(
        `Formation '${formationId}' does not belong to well '${wellIdOrBusinessId}'`,
      );
    }

    const validated = UpdateFormationSchema.parse(input);

    // Validate combined interval bounds
    const effectiveTop =
      validated.topMd !== undefined
        ? Number(validated.topMd)
        : Number(formation.topMd);
    const effectiveBottom =
      validated.bottomMd !== undefined
        ? Number(validated.bottomMd)
        : Number(formation.bottomMd);

    if (effectiveBottom < effectiveTop) {
      throw AppError.validation(
        "bottomMd must be greater than or equal to topMd",
      );
    }

    return this.repo.update(formation.id, validated);
  }
}

export const formationService = new FormationService();
