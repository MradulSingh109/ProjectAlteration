/**
 * Operational well lifecycle status
 */
export const WellStatus = {
  PLANNED: "PLANNED",
  DRILLING: "DRILLING",
  COMPLETED: "COMPLETED",
  ABANDONED: "ABANDONED",
} as const;

export type WellStatus = (typeof WellStatus)[keyof typeof WellStatus];

export const ALL_WELL_STATUSES: WellStatus[] = [
  WellStatus.PLANNED,
  WellStatus.DRILLING,
  WellStatus.COMPLETED,
  WellStatus.ABANDONED,
];

import { Prisma } from "@prisma/client";

/**
 * Domain entity representing a Well master record.
 * Decoupled from ORM models.
 */
export interface WellEntity {
  id: string;
  wellId: string;
  name: string;
  field: string;
  latitude: number;
  longitude: number;
  spudDate: Date | null;
  plannedDepthMd: number | Prisma.Decimal;
  plannedDepthTvd: number | Prisma.Decimal;
  status: WellStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Result representation for spatial proximity searches.
 */
export interface NearbyWellResult {
  id: string;
  wellId: string;
  name: string;
  field: string;
  latitude: number;
  longitude: number;
  status: WellStatus;
  distanceKm: number;
}
