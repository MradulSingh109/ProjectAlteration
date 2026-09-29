import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/application/auth/guard";
import { mlClient } from "@/infrastructure/ml/ml-client";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

const AssistantQuerySchema = z.object({
  query: z.string().min(2).optional(),
  question: z.string().min(2).optional(),
  wellId: z.string().optional(),
  formation: z.string().optional(),
  eventType: z.string().optional(),
  minDepth: z.number().positive().optional(),
  maxDepth: z.number().positive().optional(),
  topK: z.number().int().min(1).max(20).default(4),
}).refine((data) => !!(data.query || data.question), {
  message: "Either 'query' or 'question' must be provided",
  path: ["query"],
});

/**
 * POST /api/v1/assistant
 *
 * Evidence-backed Knowledge Assistant conforming to Roadmap Step 10 & 14.
 * Integrates with the RAG ML engine to retrieve answers grounded in
 * daily drilling reports, mud logs, and well completion reports.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);

    const body = await req.json();
    const parsed = AssistantQuerySchema.safeParse(body);
    if (!parsed.success) {
      throw AppError.validation(
        parsed.error.issues[0]?.message || "Invalid assistant query",
        parsed.error.issues,
      );
    }

    const { query, question, wellId, formation, eventType, minDepth, maxDepth, topK } = parsed.data;
    const finalQuery = (query || question)!.trim();

    const result = await mlClient.queryRAG(
      finalQuery,
      {
        wellId,
        formation,
        eventType,
        minDepth,
        maxDepth,
      },
      topK,
    );

    return successResponse(result, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
