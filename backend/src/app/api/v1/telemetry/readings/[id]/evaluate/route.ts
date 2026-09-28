import { NextRequest } from "next/server";
import { requireAuth } from "@/application/auth/guard";
import { Role } from "@/domain/auth/roles";
import { verifyCsrf } from "@/infrastructure/auth/csrf.guard";
import { ruleEvaluationService } from "@/application/alerts/rule-evaluation.service";
import { successResponse, errorResponse } from "@/lib/response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/telemetry/readings/:id/evaluate
 *
 * Explicitly triggers deterministic rule evaluation for a telemetry reading.
 * Idempotently persists any newly triggered alerts.
 *
 * RBAC: Restricted to operational roles (ADMIN, DRILLING_ENGINEER, GEOLOGIST).
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireAuth(
      req,
      Role.ADMIN,
      Role.DRILLING_ENGINEER,
      Role.GEOLOGIST,
    );
    verifyCsrf(req);

    const { id: readingId } = await params;

    const result = await ruleEvaluationService.evaluateReading(
      readingId,
      user.id,
      user.role,
    );

    return successResponse(result, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
