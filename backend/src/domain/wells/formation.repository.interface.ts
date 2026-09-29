import { FormationEntity } from "./formation.entity";

export interface IFormationRepository {
  create(
    data: Omit<FormationEntity, "id" | "createdAt" | "updatedAt">,
  ): Promise<FormationEntity>;
  findById(id: string): Promise<FormationEntity | null>;
  listByWellId(wellId: string): Promise<FormationEntity[]>;
  update(
    id: string,
    data: Partial<
      Omit<FormationEntity, "id" | "wellId" | "createdAt" | "updatedAt">
    >,
  ): Promise<FormationEntity>;
}
