import { Prisma } from "@prisma/client";

/**
 * Domain entity representing a geological formation/stratigraphy interval.
 * Decoupled from ORM models.
 */
export interface FormationEntity {
  id: string;
  wellId: string;
  name: string;
  topMd: number | Prisma.Decimal;
  bottomMd: number | Prisma.Decimal;
  lithology: string | null;
  createdAt: Date;
  updatedAt: Date;
}
