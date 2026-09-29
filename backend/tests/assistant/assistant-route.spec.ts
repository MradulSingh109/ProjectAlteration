import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/v1/assistant/route";
import * as authGuard from "@/application/auth/guard";
import { mlClient } from "@/infrastructure/ml/ml-client";
import { Role } from "@/domain/auth/roles";

vi.mock("@/application/auth/guard");
vi.mock("@/infrastructure/ml/ml-client", () => ({
  mlClient: {
    queryRAG: vi.fn(),
  },
}));

describe("POST /api/v1/assistant", () => {
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
  });

  it("successfully passes question and filters to RAG ML service and returns 200", async () => {
    vi.mocked(mlClient.queryRAG).mockResolvedValue({
      query: "What mitigations were used for mud losses in Barail?",
      answer: "Mica LCM pill was pumped.",
      confidence: 0.95,
      sources: [
        {
          document_id: "WCR_W087_Final.pdf",
          page: 15,
          section: "Mud Loss Incident",
          text_snippet: "Pumped 25 bbl mica LCM pill...",
          score: 0.92,
        },
      ],
    });

    const req = new NextRequest("http://localhost:3000/api/v1/assistant", {
      method: "POST",
      body: JSON.stringify({
        question: "What mitigations were used for mud losses in Barail?",
        formation: "Barail",
        topK: 3,
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.answer).toBe("Mica LCM pill was pumped.");
    expect(json.data.sources.length).toBe(1);
    expect(vi.mocked(mlClient.queryRAG)).toHaveBeenCalledWith(
      "What mitigations were used for mud losses in Barail?",
      expect.objectContaining({ formation: "Barail" }),
      3,
    );
  });

  it("rejects request if neither query nor question is provided", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/assistant", {
      method: "POST",
      body: JSON.stringify({
        formation: "Barail",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error.message).toContain("Either 'query' or 'question' must be provided");
  });
});
