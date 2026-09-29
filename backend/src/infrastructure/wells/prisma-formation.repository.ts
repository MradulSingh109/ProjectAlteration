import { prisma } from "@/infrastructure/database/prisma";
import { IFormationRepository } from "@/domain/wells/formation.repository.interface";
import { FormationEntity } from "@/domain/wells/formation.entity";
import { Prisma, PrismaClient } from "@prisma/client";

function mapFormation(row: any): FormationEntity {
  return {
    id: row.id,
    wellId: row.wellId,
    name: row.name,
    topMd:
      row.topMd && typeof row.topMd === "object" && "toNumber" in row.topMd
        ? row.topMd.toNumber()
        : row.topMd,
    bottomMd:
      row.bottomMd &&
      typeof row.bottomMd === "object" &&
      "toNumber" in row.bottomMd
        ? row.bottomMd.toNumber()
        : row.bottomMd,
    lithology: row.lithology,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaFormationRepository implements IFormationRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async create(
    data: Omit<FormationEntity, "id" | "createdAt" | "updatedAt">,
  ): Promise<FormationEntity> {
    const formation = await this.db.formation.create({
      data: {
        wellId: data.wellId,
        name: data.name,
        topMd: new Prisma.Decimal(data.topMd.toString()),
        bottomMd: new Prisma.Decimal(data.bottomMd.toString()),
        lithology: data.lithology,
      },
    });
    return mapFormation(formation);
  }

  async findById(id: string): Promise<FormationEntity | null> {
    const formation = await this.db.formation.findUnique({
      where: { id },
    });
    return formation ? mapFormation(formation) : null;
  }

  async listByWellId(wellId: string): Promise<FormationEntity[]> {
    const formations = await this.db.formation.findMany({
      where: { wellId },
      orderBy: { topMd: "asc" },
    });
    return formations.map(mapFormation);
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
        ...(data.topMd !== undefined
          ? { topMd: new Prisma.Decimal(data.topMd.toString()) }
          : {}),
        ...(data.bottomMd !== undefined
          ? { bottomMd: new Prisma.Decimal(data.bottomMd.toString()) }
          : {}),
        ...(data.lithology !== undefined ? { lithology: data.lithology } : {}),
      },
    });
    return mapFormation(formation);
  }
}

export const formationRepository = new PrismaFormationRepository();
