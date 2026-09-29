import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/v1/telemetry/predict-risk/route";
import * as authGuard from "@/application/auth/guard";
import { wellService } from "@/application/wells/well.service";
import { mlClient } from "@/infrastructure/ml/ml-client";
import { Role } from "@/domain/auth/roles";
import { WellStatus } from "@/domain/wells/well.entity";

vi.mock("@/application/auth/guard");
vi.mock("@/application/wells/well.service", () => ({
  wellService: {
    getWell: vi.fn(),
  },
}));
vi.mock("@/infrastructure/ml/ml-client", () => ({
  mlClient: {
    predictMudLossRisk: vi.fn(),
  },
}));

describe("POST /api/v1/telemetry/predict-risk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authGuard.requireAuth).mockResolvedValue({
      user: {
        id: "user-1",
        email: "engineer@nwis.gov.in",
        role: Role.DRILLING_ENGINEER,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      sessionId: "session-1",
      tokenPayload: {
        sub: "user-1",
        email: "engineer@nwis.gov.in",
        role: Role.DRILLING_ENGINEER,
        sessionId: "session-1",
      },
    });

    vi.mocked(wellService.getWell).mockResolvedValue({
      id: "well-uuid-1",
      wellId: "W-087",
      name: "Well W-087",
      field: "UpperAssam",
      latitude: 27.4,
      longitude: 95.1,
      spudDate: new Date(),
      status: WellStatus.DRILLING,
      plannedDepthMd: 3500,
      plannedDepthTvd: 3300,
      createdAt: new Date(),
      updatedAt: new Date(),
      formations: [
        {
          id: "fmt-1",
          wellId: "well-uuid-1",
          name: "Barail",
          topMd: 2800,
          bottomMd: 3600,
          lithology: "Coal / Shale / Sandstone Sequence",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
  });

  it("maps telemetry features and returns ML risk assessment", async () => {
    vi.mocked(mlClient.predictMudLossRisk).mockResolvedValue({
      well_id: "W-087",
      depth_md: 2950,
      risk_type: "MUD_LOSS",
      probability: 0.74,
      level: "HIGH",
      model_version: "rf-mud-loss-v1",
      top_contributing_features: [{ feature: "flow_rate_gpm", importance: 0.22 }],
      mitigation_recommendation: "HIGH RISK: Monitor pit volume and reduce flow rate.",
    });

    const req = new NextRequest("http://localhost:3000/api/v1/telemetry/predict-risk", {
      method: "POST",
      body: JSON.stringify({
        wellId: "W-087",
        depthMd: 2950,
        rateOfPenetration: 6.2,
        standpipePressure: 2400,
        flowRateIn: 420,
        mudDensity: 10.5,
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.prediction.level).toBe("HIGH");
    expect(json.data.prediction.probability).toBe(0.74);
    expect(json.data.features.formation).toBe("Barail");
  });
});
