/**
 * Core physical drilling telemetry measurements.
 * All units are standardized according to oilfield engineering conventions:
 * - Depths: meters (MD and TVD)
 * - ROP: meters per hour (m/hr)
 * - Hook Load: thousand pounds-force (klbf)
 * - Pressures: pounds per square inch (psi)
 * - Torque: foot-pounds force (ft-lbf)
 * - Rotary Speed: revolutions per minute (RPM)
 * - Flow Rates: gallons per minute (gpm)
 * - Mud Density: pounds per gallon (ppg)
 */
export interface TelemetryMeasurements {
  depthMd: number;
  depthTvd?: number | null;
  rateOfPenetration?: number | null;
  hookLoad?: number | null;
  standpipePressure?: number | null;
  annularPressure?: number | null;
  surfaceTorque?: number | null;
  rotaryRpm?: number | null;
  flowRateIn?: number | null;
  flowRateOut?: number | null;
  mudDensity?: number | null;
}

/**
 * Canonical domain entity representing a validated drilling telemetry reading.
 * Transport-independent and decoupled from ORM models.
 */
export interface CanonicalTelemetryReading {
  id: string;
  wellId: string;
  sourceId: string;
  sequenceNumber: number; // BigInt represented as integer in application domain
  timestamp: Date; // UTC measurement timestamp
  measurements: TelemetryMeasurements;
  metadata?: Record<string, unknown> | null;
  ingestedAt: Date; // Server arrival timestamp
  createdAt: Date;
}

/**
 * Ingestion outcome status.
 */
export type IngestionOutcome = "INGESTED" | "ALREADY_INGESTED";

/**
 * Result returned by the telemetry ingestion service.
 */
export interface IngestTelemetryResult {
  status: IngestionOutcome;
  isDuplicate: boolean;
  reading: CanonicalTelemetryReading;
}

/**
 * Filter criteria for querying telemetry time-series for a well.
 */
export interface TelemetryFilterCriteria {
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
  sortOrder?: "asc" | "desc";
}

/**
 * Pagination metadata for telemetry time-series queries.
 */
export interface TelemetryPaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

/**
 * Paginated telemetry query result.
 */
export interface PaginatedTelemetryResult {
  wellId: string;
  items: CanonicalTelemetryReading[];
  pagination: TelemetryPaginationMeta;
  timeRange: {
    from?: string;
    to?: string;
  };
}

/**
 * Input payload for repository persistence.
 */
export interface CreateTelemetryInput {
  wellId: string;
  sourceId: string;
  sequenceNumber: number | bigint;
  timestamp: Date;
  measurements: TelemetryMeasurements;
  metadata?: Record<string, unknown> | null;
}
