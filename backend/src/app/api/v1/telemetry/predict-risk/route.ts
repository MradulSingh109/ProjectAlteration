import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/application/auth/guard";
import { wellService } from "@/application/wells/well.service";
import { telemetryFeatureMapper } from "@/application/telemetry/telemetry-feature-mapper";
import { mlClient } from "@/infrastructure/ml/ml-client";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

const PredictRiskSchema = z.object({
  wellId: z.string().min(1),
  depthMd: z.number().positive(),
  rateOfPenetration: z.number().nullable().optional(),
  hookLoad: z.number().nullable().optional(),
  standpipePressure: z.number().nullable().optional(),
  surfaceTorque: z.number().nullable().optional(),
  rotaryRpm: z.number().nullable().optional(),
  flowRateIn: z.number().nullable().optional(),
  flowRateOut: z.number().nullable().optional(),
  mudDensity: z.number().nullable().optional(),
  metadata: z.record(z.string(), z.any()).nullable().optional(),
});

/**
 * POST /api/v1/telemetry/predict-risk
 *
 * Real-time Mud Loss Hazard Prediction endpoint.
 * Takes live sensor telemetry, aligns stratigraphy and physics baselines,
 * and calls the ML Random Forest Inference Microservice.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);

    const body = await req.json();
    const parsed = PredictRiskSchema.safeParse(body);
    if (!parsed.success) {
      throw AppError.validation(
        parsed.error.issues[0]?.message || "Invalid prediction payload",
        parsed.error.issues,
      );
    }

    const { wellId, depthMd, ...measurements } = parsed.data;
    const well = await wellService.getWell(wellId);

    const mlPayload = telemetryFeatureMapper.mapToMlRiskPayload(
      { depthMd, ...measurements },
      well,
      well.formations || [],
    );

    const prediction = await mlClient.predictMudLossRisk({
      wellId: mlPayload.well_id,
      depthMd: mlPayload.depth_md,
      formation: mlPayload.formation,
      lithology: mlPayload.lithology,
      ropMhr: mlPayload.rop_mhr,
      wobKlbs: mlPayload.wob_klbs,
      rpm: mlPayload.rpm,
      torqueKftlb: mlPayload.torque_kftlb,
      sppPsi: mlPayload.spp_psi,
      flowRateGpm: mlPayload.flow_rate_gpm,
      mudWeightPpg: mlPayload.mud_weight_ppg,
      ecdPpg: mlPayload.ecd_ppg,
    });

    return successResponse({ prediction, features: mlPayload }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
