import { WellEntity, WellStatus, NearbyWellResult } from "./well.entity";
import { FormationEntity } from "./formation.entity";

export interface IWellRepository {
  create(
    data: Omit<WellEntity, "id" | "createdAt" | "updatedAt">,
  ): Promise<WellEntity>;
  findById(
    id: string,
  ): Promise<(WellEntity & { formations?: FormationEntity[] }) | null>;
  findByWellId(
    wellId: string,
  ): Promise<(WellEntity & { formations?: FormationEntity[] }) | null>;
  list(filter?: {
    field?: string;
    status?: WellStatus;
    limit?: number;
    offset?: number;
  }): Promise<WellEntity[]>;
  update(
    id: string,
    data: Partial<
      Omit<WellEntity, "id" | "wellId" | "createdAt" | "updatedAt">
    >,
  ): Promise<WellEntity>;
  findNearby(
    latitude: number,
    longitude: number,
    radiusKm: number,
    limit?: number,
  ): Promise<NearbyWellResult[]>;
}
