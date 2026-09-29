import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/v1/risk/[id]/route";
import * as authGuard from "@/application/auth/guard";
import { wellService } from "@/application/wells/well.service";
import { prisma } from "@/infrastructure/database/prisma";
import { mlClient } from "@/infrastructure/ml/ml-client";
import { Role } from "@/domain/auth/roles";
import { WellStatus } from "@/domain/wells/well.entity";

vi.mock("@/application/auth/guard");
vi.mock("@/application/wells/well.service", () => ({
  wellService: {
    getWell: vi.fn(),
  },
}));
vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    telemetryReading: {
      findFirst: vi.fn(),
    },
  },
}));
vi.mock("@/infrastructure/ml/ml-client", () => ({
  mlClient: {
    predictMudLossRisk: vi.fn(),
  },
}));

describe("GET /api/v1/risk/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authGuard.requireAuth).mockResolvedValue({
      user: {
        id: "user-1",
        email: "demo@nwis.gov.in",
        role: Role.ADMIN,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      sessionId: "session-1",
      tokenPayload: {
        sub: "user-1",
        email: "demo@nwis.gov.in",
        role: Role.ADMIN,
        sessionId: "session-1",
      },
    });

    vi.mocked(wellService.getWell).mockResolvedValue({
      id: "well-uuid-114",
      wellId: "DLJ-114",
      name: "OIL-DLJ-114",
      field: "Duliajan",
      latitude: 27.35,
      longitude: 95.3,
      spudDate: new Date(),
      status: WellStatus.DRILLING,
      plannedDepthMd: 3500,
      plannedDepthTvd: 3300,
      createdAt: new Date(),
      updatedAt: new Date(),
      formations: [],
    });
  });

  it("returns multi-hazard risk profile for well integrating ML model prediction", async () => {
    vi.mocked(prisma.telemetryReading.findFirst).mockResolvedValue({
      id: "tel-1",
      wellId: "well-uuid-114",
      depthMd: 2848 as any,
      rateOfPenetration: 12.5 as any,
      surfaceTorque: 1850 as any,
      mudDensity: 9.8 as any,
      flowRateIn: 550 as any,
      flowRateOut: 525 as any,
      standpipePressure: 2200 as any,
      rotaryRpm: 110 as any,
      hookLoad: 120 as any,
      timestamp: new Date("2026-09-28T14:15:00Z"),
    } as any);

    vi.mocked(mlClient.predictMudLossRisk).mockResolvedValue({
      well_id: "DLJ-114",
      depth_md: 2848,
      risk_type: "MUD_LOSS",
      probability: 0.78,
      level: "HIGH",
      model_version: "rf-mud-loss-v1",
      top_contributing_features: [{ feature: "flow_rate_gpm", importance: 0.2 }],
      mitigation_recommendation: "Monitor pit volume closely.",
    });

    const req = new NextRequest("http://localhost:3000/api/v1/risk/DLJ-114");
    const res = await GET(req, { params: Promise.resolve({ id: "DLJ-114" }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    const risks = json.data;
    expect(risks.length).toBeGreaterThan(0);
    const mudLoss = risks.find((r: any) => r.risk_type === "MUD_LOSS");
    expect(mudLoss).toBeDefined();
    expect(mudLoss.probability).toBe(0.78);
    expect(mudLoss.level).toBe("HIGH");
    expect(mudLoss.depth).toBe(2848);
  });
});
