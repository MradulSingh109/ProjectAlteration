import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MLClient } from "@/infrastructure/ml/ml-client";
import { AppError } from "@/lib/errors";

describe("MLClient", () => {
  let client: MLClient;
  const originalFetch = global.fetch;

  beforeEach(() => {
    client = new MLClient("http://test-ml-service:8000");
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("checkHealth", () => {
    it("returns health info when microservice is healthy", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: "healthy",
          risk_model_loaded: true,
          rag_assistant_loaded: true,
          rag_chunks_indexed: 34,
        }),
      } as any);

      const health = await client.checkHealth();
      expect(health.status).toBe("healthy");
      expect(health.risk_model_loaded).toBe(true);
      expect(health.rag_chunks_indexed).toBe(34);
    });

    it("throws AppError if service is unreachable", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

      await expect(client.checkHealth()).rejects.toThrow(AppError);
    });
  });

  describe("predictMudLossRisk", () => {
    it("sends payload conforming to Section 4.3 and returns risk assessment", async () => {
      let capturedBody: any = null;
      global.fetch = vi.fn().mockImplementation(async (url: string, opts: any) => {
        capturedBody = JSON.parse(opts.body);
        return {
          ok: true,
          json: async () => ({
            well_id: capturedBody.well_id,
            depth_md: capturedBody.depth_md,
            risk_type: "MUD_LOSS",
            probability: 0.85,
            level: "CRITICAL",
            model_version: "rf-mud-loss-v1",
            top_contributing_features: [{ feature: "flow_rate_gpm", importance: 0.25 }],
            mitigation_recommendation: "CRITICAL: Stop drilling and pump LCM pill immediately.",
          }),
        };
      });

      const res = await client.predictMudLossRisk({
        wellId: "W-087",
        depthMd: 2950,
        formation: "Barail",
        flowRateGpm: 380,
      });

      expect(res.level).toBe("CRITICAL");
      expect(res.probability).toBe(0.85);
      expect(capturedBody.well_id).toBe("W-087");
      expect(capturedBody.depth_md).toBe(2950);
      expect(capturedBody.formation).toBe("Barail");
      expect(capturedBody.flow_rate_gpm).toBe(380);
    });
  });

  describe("queryRAG", () => {
    it("forwards query and filters to ML assistant and returns evidence sources", async () => {
      let capturedBody: any = null;
      global.fetch = vi.fn().mockImplementation(async (url: string, opts: any) => {
        capturedBody = JSON.parse(opts.body);
        return {
          ok: true,
          json: async () => ({
            query: capturedBody.query,
            answer: "Mud loss in Barail is typically mitigated with Mica LCM.",
            confidence: 0.92,
            sources: [
              {
                document_id: "WCR_W087_Final.pdf",
                page: 12,
                section: "Mud Loss Incident",
                text_snippet: "Pumped 25 bbl mica LCM pill...",
                score: 0.88,
              },
            ],
          }),
        };
      });

      const res = await client.queryRAG(
        "What mitigations for Barail mud loss?",
        { wellId: "W-087", formation: "Barail" },
        3,
      );

      expect(capturedBody.query).toBe("What mitigations for Barail mud loss?");
      expect(capturedBody.well_id).toBe("W-087");
      expect(capturedBody.formation).toBe("Barail");
      expect(capturedBody.top_k).toBe(3);
      expect(res.sources.length).toBe(1);
      expect(res.sources[0].document_id).toBe("WCR_W087_Final.pdf");
    });
  });
});
