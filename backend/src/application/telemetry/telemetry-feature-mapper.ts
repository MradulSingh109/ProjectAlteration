import {
  CanonicalTelemetryReading,
  TelemetryMeasurements,
} from "@/domain/telemetry/telemetry.entity";
import { FormationEntity } from "@/domain/wells/formation.entity";
import { WellEntity } from "@/domain/wells/well.entity";

/**
 * Standardized input payload conforming to ML Roadmap Section 4.3 and ml/src/risk/schemas.py.
 */
export interface MlRiskPredictionPayload {
  well_id: string;
  depth_md: number;
  formation: string;
  lithology: string;
  rop_mhr: number;
  wob_klbs: number;
  rpm: number;
  torque_kftlb: number;
  spp_psi: number;
  flow_rate_gpm: number;
  mud_weight_ppg: number;
  ecd_ppg: number;
  offset_wells_count_in_radius?: number | null;
  max_offset_similarity?: number | null;
  offset_mud_loss_count?: number | null;
  offset_stuck_pipe_count?: number | null;
  offset_kick_count?: number | null;
  offset_torque_spike_count?: number | null;
  nearest_hazard_distance_km?: number | null;
  offset_hazard_density?: number | null;
}

export class TelemetryFeatureMapper {
  /**
   * Transforms a backend TelemetryReading into the feature vector expected
   * by the ML Mud Loss Risk Prediction model.
   *
   * @param reading - Backend raw or persisted telemetry reading
   * @param well - Master well record
   * @param formations - Ordered formations associated with the well
   */
  mapToMlRiskPayload(
    reading:
      | CanonicalTelemetryReading
      | {
          depthMd: number;
          rateOfPenetration?: number | null;
          hookLoad?: number | null;
      standpipePressure?: number | null;
      surfaceTorque?: number | null;
      rotaryRpm?: number | null;
      flowRateIn?: number | null;
      flowRateOut?: number | null;
      mudDensity?: number | null;
      metadata?: Record<string, any> | null;
    },
    well: WellEntity,
    formations: FormationEntity[] = [],
  ): MlRiskPredictionPayload {
    const m: TelemetryMeasurements =
      "measurements" in reading && reading.measurements
        ? reading.measurements
        : (reading as any);

    const depth = Number(m.depthMd || 0);

    // 1. Stratigraphic formation lookup by depth interval
    let activeFormation = "Unknown";
    let activeLithology = "Porous Sandstone / Siltstone";

    const matched = formations.find(
      (f) => depth >= Number(f.topMd) && depth <= Number(f.bottomMd),
    );

    if (matched) {
      activeFormation = matched.name;
      if (matched.lithology) {
        activeLithology = matched.lithology;
      }
    } else if (formations.length > 0) {
      // Pick nearest formation if between boundaries
      const sorted = [...formations].sort(
        (a, b) => Math.abs(Number(a.topMd) - depth) - Math.abs(Number(b.topMd) - depth),
      );
      activeFormation = sorted[0].name;
      if (sorted[0].lithology) activeLithology = sorted[0].lithology;
    }

    // 2. Weight on Bit derivation
    // If metadata contains direct WOB, use it; otherwise infer from hookLoad or default standard 24 klbs
    let wobKlbs = 24.0;
    const meta = "metadata" in reading ? (reading.metadata as Record<string, any> | undefined) : undefined;
    if (meta && typeof meta.wob === "number") {
      wobKlbs = meta.wob;
    } else if (m.hookLoad !== undefined && m.hookLoad !== null) {
      // Typical estimation: Drill string buoyant weight minus hook load
      const estimatedStringWeight = Math.max(depth * 0.035, 60.0);
      wobKlbs = Math.max(Number((estimatedStringWeight - Number(m.hookLoad)).toFixed(1)), 5.0);
    }

    // 3. Flow rate harmonization: prefer flowRateIn, fallback to flowRateOut, default 550 gpm
    const flowRate =
      m.flowRateIn !== undefined && m.flowRateIn !== null
        ? Number(m.flowRateIn)
        : m.flowRateOut !== undefined && m.flowRateOut !== null
        ? Number(m.flowRateOut)
        : 550.0;

    // 4. Mud density / ECD mapping
    const mudWeight =
      m.mudDensity !== undefined && m.mudDensity !== null
        ? Number(m.mudDensity)
        : 9.8;
    const ecd = Number((mudWeight + 0.4).toFixed(2));

    return {
      well_id: well.wellId || well.name,
      depth_md: depth,
      formation: activeFormation,
      lithology: activeLithology,
      rop_mhr: m.rateOfPenetration !== undefined && m.rateOfPenetration !== null ? Number(m.rateOfPenetration) : 12.0,
      wob_klbs: wobKlbs,
      rpm: m.rotaryRpm !== undefined && m.rotaryRpm !== null ? Number(m.rotaryRpm) : 110.0,
      torque_kftlb: m.surfaceTorque !== undefined && m.surfaceTorque !== null ? Number(m.surfaceTorque) : 8.0,
      spp_psi: m.standpipePressure !== undefined && m.standpipePressure !== null ? Number(m.standpipePressure) : 2200.0,
      flow_rate_gpm: flowRate,
      mud_weight_ppg: mudWeight,
      ecd_ppg: ecd,
    };
  }
}

export const telemetryFeatureMapper = new TelemetryFeatureMapper();
