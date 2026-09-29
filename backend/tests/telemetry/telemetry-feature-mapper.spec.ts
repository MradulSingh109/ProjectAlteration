import { describe, it, expect } from "vitest";
import { telemetryFeatureMapper } from "@/application/telemetry/telemetry-feature-mapper";
import { WellStatus } from "@/domain/wells/well.entity";

describe("TelemetryFeatureMapper", () => {
  const dummyWell = {
    id: "well-uuid-1",
    wellId: "OIL-102",
    name: "OIL-102",
    field: "UpperAssam",
    latitude: 27.46,
    longitude: 95.06,
    spudDate: null,
    plannedDepthMd: 3500,
    plannedDepthTvd: 3400,
    status: WellStatus.DRILLING,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const dummyFormations = [
    {
      id: "f-1",
      wellId: "well-uuid-1",
      name: "Tipam Sandstone",
      topMd: 1800,
      bottomMd: 2500,
      lithology: "Clean Porous Sandstone",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "f-2",
      wellId: "well-uuid-1",
      name: "Barail Coal-Shale",
      topMd: 2501,
      bottomMd: 3200,
      lithology: "Carbonaceous Shale / Coal",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  it("correctly identifies active formation and formats features for ML risk model", () => {
    const reading = {
      depthMd: 2850,
      rateOfPenetration: 14.5,
      hookLoad: 42.0,
      standpipePressure: 2450.0,
      surfaceTorque: 9.5,
      rotaryRpm: 120.0,
      flowRateIn: 580.0,
      flowRateOut: 520.0,
      mudDensity: 10.2,
      metadata: { wob: 26.5 },
    };

    const payload = telemetryFeatureMapper.mapToMlRiskPayload(
      reading,
      dummyWell,
      dummyFormations,
    );

    expect(payload.well_id).toBe("OIL-102");
    expect(payload.depth_md).toBe(2850);
    expect(payload.formation).toBe("Barail Coal-Shale");
    expect(payload.lithology).toBe("Carbonaceous Shale / Coal");
    expect(payload.rop_mhr).toBe(14.5);
    expect(payload.wob_klbs).toBe(26.5);
    expect(payload.rpm).toBe(120.0);
    expect(payload.torque_kftlb).toBe(9.5);
    expect(payload.spp_psi).toBe(2450.0);
    expect(payload.flow_rate_gpm).toBe(580.0);
    expect(payload.mud_weight_ppg).toBe(10.2);
    expect(payload.ecd_ppg).toBe(10.6);
  });
});
