import { prisma } from "@/infrastructure/database/prisma";
import { Prisma, PrismaClient } from "@prisma/client";
import { ITelemetryRepository } from "@/domain/telemetry/telemetry.repository.interface";
import {
  CanonicalTelemetryReading,
  CreateTelemetryInput,
  TelemetryFilterCriteria,
  PaginatedTelemetryResult,
} from "@/domain/telemetry/telemetry.entity";

function toDecimalNumber(val: unknown): number | null {
  if (val == null) return null;
  if (
    typeof val === "object" &&
    val !== null &&
    "toNumber" in val &&
    typeof (val as { toNumber: () => number }).toNumber === "function"
  ) {
    return (val as { toNumber: () => number }).toNumber();
  }
  return Number(val);
}

function mapTelemetryReading(row: {
  id: string;
  wellId: string;
  sourceId: string;
  sequenceNumber: bigint;
  timestamp: Date;
  depthMd: Prisma.Decimal;
  depthTvd: Prisma.Decimal | null;
  rateOfPenetration: Prisma.Decimal | null;
  hookLoad: Prisma.Decimal | null;
  standpipePressure: Prisma.Decimal | null;
  annularPressure: Prisma.Decimal | null;
  surfaceTorque: Prisma.Decimal | null;
  rotaryRpm: Prisma.Decimal | null;
  flowRateIn: Prisma.Decimal | null;
  flowRateOut: Prisma.Decimal | null;
  mudDensity: Prisma.Decimal | null;
  metadata: Prisma.JsonValue | null;
  ingestedAt: Date;
  createdAt: Date;
}): CanonicalTelemetryReading {
  return {
    id: row.id,
    wellId: row.wellId,
    sourceId: row.sourceId,
    sequenceNumber: Number(row.sequenceNumber),
    timestamp: row.timestamp,
    measurements: {
      depthMd: toDecimalNumber(row.depthMd)!,
      depthTvd: toDecimalNumber(row.depthTvd),
      rateOfPenetration: toDecimalNumber(row.rateOfPenetration),
      hookLoad: toDecimalNumber(row.hookLoad),
      standpipePressure: toDecimalNumber(row.standpipePressure),
      annularPressure: toDecimalNumber(row.annularPressure),
      surfaceTorque: toDecimalNumber(row.surfaceTorque),
      rotaryRpm: toDecimalNumber(row.rotaryRpm),
      flowRateIn: toDecimalNumber(row.flowRateIn),
      flowRateOut: toDecimalNumber(row.flowRateOut),
      mudDensity: toDecimalNumber(row.mudDensity),
    },
    metadata:
      row.metadata &&
      typeof row.metadata === "object" &&
      !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null,
    ingestedAt: row.ingestedAt,
    createdAt: row.createdAt,
  };
}

export class PrismaTelemetryRepository implements ITelemetryRepository {
  constructor(private readonly prismaClient: PrismaClient = prisma) {}

  async create(data: CreateTelemetryInput): Promise<CanonicalTelemetryReading> {
    const row = await this.prismaClient.telemetryReading.create({
      data: {
        wellId: data.wellId,
        sourceId: data.sourceId,
        sequenceNumber: BigInt(data.sequenceNumber),
        timestamp: data.timestamp,
        depthMd: new Prisma.Decimal(data.measurements.depthMd.toString()),
        depthTvd:
          data.measurements.depthTvd != null
            ? new Prisma.Decimal(data.measurements.depthTvd.toString())
            : null,
        rateOfPenetration:
          data.measurements.rateOfPenetration != null
            ? new Prisma.Decimal(data.measurements.rateOfPenetration.toString())
            : null,
        hookLoad:
          data.measurements.hookLoad != null
            ? new Prisma.Decimal(data.measurements.hookLoad.toString())
            : null,
        standpipePressure:
          data.measurements.standpipePressure != null
            ? new Prisma.Decimal(data.measurements.standpipePressure.toString())
            : null,
        annularPressure:
          data.measurements.annularPressure != null
            ? new Prisma.Decimal(data.measurements.annularPressure.toString())
            : null,
        surfaceTorque:
          data.measurements.surfaceTorque != null
            ? new Prisma.Decimal(data.measurements.surfaceTorque.toString())
            : null,
        rotaryRpm:
          data.measurements.rotaryRpm != null
            ? new Prisma.Decimal(data.measurements.rotaryRpm.toString())
            : null,
        flowRateIn:
          data.measurements.flowRateIn != null
            ? new Prisma.Decimal(data.measurements.flowRateIn.toString())
            : null,
        flowRateOut:
          data.measurements.flowRateOut != null
            ? new Prisma.Decimal(data.measurements.flowRateOut.toString())
            : null,
        mudDensity:
          data.measurements.mudDensity != null
            ? new Prisma.Decimal(data.measurements.mudDensity.toString())
            : null,
        metadata:
          data.metadata != null
            ? (data.metadata as Prisma.InputJsonValue)
            : Prisma.JsonNull,
      },
    });

    return mapTelemetryReading(row);
  }

  async findById(id: string): Promise<CanonicalTelemetryReading | null> {
    const row = await this.prismaClient.telemetryReading.findUnique({
      where: { id },
    });

    return row ? mapTelemetryReading(row) : null;
  }

  async findByWellSourceSequence(
    wellId: string,
    sourceId: string,
    sequenceNumber: number | bigint,
  ): Promise<CanonicalTelemetryReading | null> {
    const row = await this.prismaClient.telemetryReading.findUnique({
      where: {
        wellId_sourceId_sequenceNumber: {
          wellId,
          sourceId,
          sequenceNumber: BigInt(sequenceNumber),
        },
      },
    });

    return row ? mapTelemetryReading(row) : null;
  }

  async listByWellId(
    wellId: string,
    criteria?: TelemetryFilterCriteria,
  ): Promise<PaginatedTelemetryResult> {
    const page = Math.max(1, criteria?.page || 1);
    const pageSize = Math.min(200, Math.max(1, criteria?.pageSize || 50));
    const sortOrder: Prisma.SortOrder =
      criteria?.sortOrder === "desc" ? "desc" : "asc";

    const where: Prisma.TelemetryReadingWhereInput = {
      wellId,
    };

    if (criteria?.from || criteria?.to) {
      where.timestamp = {};
      if (criteria.from) {
        where.timestamp.gte = criteria.from;
      }
      if (criteria.to) {
        where.timestamp.lte = criteria.to;
      }
    }

    const [totalItems, rows] = await Promise.all([
      this.prismaClient.telemetryReading.count({ where }),
      this.prismaClient.telemetryReading.findMany({
        where,
        orderBy: {
          timestamp: sortOrder,
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const totalPages =
      Math.ceil(totalItems / pageSize) || (totalItems === 0 ? 0 : 1);

    return {
      wellId,
      items: rows.map(mapTelemetryReading),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
      timeRange: {
        from: criteria?.from ? criteria.from.toISOString() : undefined,
        to: criteria?.to ? criteria.to.toISOString() : undefined,
      },
    };
  }
}

export const telemetryRepository = new PrismaTelemetryRepository();
