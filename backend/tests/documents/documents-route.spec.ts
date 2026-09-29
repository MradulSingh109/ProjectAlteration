import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/v1/documents/route";
import * as authGuard from "@/application/auth/guard";
import { prisma } from "@/infrastructure/database/prisma";
import { Role } from "@/domain/auth/roles";
import { DocumentType, IngestionStatus } from "@/domain/documents/document.entity";

vi.mock("@/application/auth/guard");
vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    document: {
      findMany: vi.fn(),
    },
  },
}));

describe("GET /api/v1/documents", () => {
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

  it("lists all documents with event counts and status mapping", async () => {
    vi.mocked(prisma.document.findMany).mockResolvedValue([
      {
        id: "doc-uuid-1",
        filename: "DDR_DLJ_114_Aug.pdf",
        documentType: DocumentType.DDR,
        mimeType: "application/pdf",
        fileSize: 1048576,
        wellId: "well-uuid-1",
        ingestionStatus: IngestionStatus.COMPLETED,
        uploadedAt: new Date("2026-09-28T12:00:00Z"),
        well: {
          id: "well-uuid-1",
          wellId: "DLJ-114",
          name: "OIL-DLJ-114",
          field: "Duliajan",
        },
        _count: {
          events: 14,
        },
      } as any,
    ]);

    const req = new NextRequest("http://localhost:3000/api/v1/documents");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.documents.length).toBe(1);

    const doc = json.data.documents[0];
    expect(doc.document_id).toBe("doc-uuid-1");
    expect(doc.filename).toBe("DDR_DLJ_114_Aug.pdf");
    expect(doc.well_id).toBe("DLJ-114");
    expect(doc.status).toBe("indexed");
    expect(doc.events_extracted).toBe(14);
  });
});
