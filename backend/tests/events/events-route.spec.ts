import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/v1/events/route";
import * as authGuard from "@/application/auth/guard";
import { prisma } from "@/infrastructure/database/prisma";
import { Role } from "@/domain/auth/roles";

vi.mock("@/application/auth/guard");
vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    drillingEvent: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    well: {
      findFirst: vi.fn(),
    },
  },
}));

describe("GET /api/v1/events", () => {
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

  it("lists all drilling events and normalizes schema for frontend consumption", async () => {
    vi.mocked(prisma.drillingEvent.count).mockResolvedValue(1);
    vi.mocked(prisma.drillingEvent.findMany).mockResolvedValue([
      {
        id: "event-uuid-1",
        mlEventId: "E-001",
        wellId: "well-uuid-1",
        eventType: "MUD_LOSS" as any,
        depthMd: 2812 as any,
        formation: "Barail Sandstone",
        severity: "HIGH" as any,
        description: "Partial mud loss observed",
        cause: "Permeable sand",
        mitigation: "Spotted mica LCM",
        sourceDocumentId: "doc-1",
        sourcePage: 14,
        reviewStatus: "APPROVED" as any,
        evidence: { note: "Loss rate 20 bbl/hr" },
        createdAt: new Date("2026-09-28T10:00:00Z"),
        well: {
          id: "well-uuid-1",
          wellId: "DLJ-098",
          name: "OIL-DLJ-098",
          field: "Duliajan",
        },
        sourceDocument: {
          id: "doc-1",
          filename: "DDR_DLJ098.pdf",
          documentType: "DDR" as any,
        },
      } as any,
    ]);

    const req = new NextRequest("http://localhost:3000/api/v1/events?type=mud_loss");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.events.length).toBe(1);

    const ev = json.data.events[0];
    expect(ev.well_id).toBe("DLJ-098");
    expect(ev.type).toBe("mud_loss");
    expect(ev.severity).toBe("high");
    expect(ev.depth_md).toBe(2812);
    expect(ev.evidence.note).toBe("Loss rate 20 bbl/hr");
  });
});
