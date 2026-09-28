import { prisma } from "@/infrastructure/database/prisma";
import { IFormationRepository } from "@/domain/wells/formation.repository.interface";
import { FormationEntity } from "@/domain/wells/formation.entity";
import { PrismaClient } from "@prisma/client";

export class PrismaFormationRepository implements IFormationRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async create(
    data: Omit<FormationEntity, "id" | "createdAt" | "updatedAt">,
  ): Promise<FormationEntity> {
    const formation = await this.db.formation.create({
      data: {
        wellId: data.wellId,
        name: data.name,
        topMd: data.topMd,
        bottomMd: data.bottomMd,
        lithology: data.lithology,
      },
    });
    return formation as unknown as FormationEntity;
  }

  async findById(id: string): Promise<FormationEntity | null> {
    const formation = await this.db.formation.findUnique({
      where: { id },
    });
    return (formation as unknown as FormationEntity) || null;
  }

  async listByWellId(wellId: string): Promise<FormationEntity[]> {
    const formations = await this.db.formation.findMany({
      where: { wellId },
      orderBy: { topMd: "asc" },
    });
    return formations as unknown as FormationEntity[];
  }

  async update(
    id: string,
    data: Partial<
      Omit<FormationEntity, "id" | "wellId" | "createdAt" | "updatedAt">
    >,
  ): Promise<FormationEntity> {
    const formation = await this.db.formation.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.topMd !== undefined ? { topMd: data.topMd } : {}),
        ...(data.bottomMd !== undefined ? { bottomMd: data.bottomMd } : {}),
        ...(data.lithology !== undefined ? { lithology: data.lithology } : {}),
      },
    });
    return formation as unknown as FormationEntity;
  }
}

export const formationRepository = new PrismaFormationRepository();
