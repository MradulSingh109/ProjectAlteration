import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/v1/alerts/route";
import * as authGuard from "@/application/auth/guard";
import { prisma } from "@/infrastructure/database/prisma";
import { Role } from "@/domain/auth/roles";
import { AlertStatus } from "@/domain/alerts/alert.entity";
import { EventSeverity } from "@prisma/client";

vi.mock("@/application/auth/guard");
vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    alert: {
      findMany: vi.fn(),
    },
    well: {
      findFirst: vi.fn(),
    },
  },
}));

describe("GET /api/v1/alerts", () => {
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
  });

  it("lists alerts across wells and provides frontend-compatible shapes", async () => {
    vi.mocked(prisma.alert.findMany).mockResolvedValue([
      {
        id: "alert-1",
        wellId: "well-uuid-1",
        ruleVersionId: "rule-ver-1",
        telemetryReadingId: "tel-1",
        alertType: "MUD_LOSS",
        severity: EventSeverity.HIGH,
        status: AlertStatus.ACTIVE,
        triggeredAt: new Date("2026-09-28T14:15:00Z"),
        explanation: "Flow discrepancy",
        evidence: ["E-001", "E-002"],
        well: {
          id: "well-uuid-1",
          wellId: "DLJ-114",
          name: "OIL-DLJ-114",
          field: "Duliajan",
        },
        telemetryReading: {
          depthMd: 2848 as any,
          timestamp: new Date("2026-09-28T14:15:00Z"),
        },
      } as any,
    ]);

    const req = new NextRequest("http://localhost:3000/api/v1/alerts?status=open");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.alerts.length).toBe(1);

    const a = json.data.alerts[0];
    expect(a.well_id).toBe("DLJ-114");
    expect(a.status).toBe("open");
    expect(a.risk_type).toBe("MUD_LOSS");
    expect(a.level).toBe("HIGH");
    expect(a.depth).toBe(2848);
  });
});
