import { NextRequest } from "next/server";
import { requireAuth } from "@/application/auth/guard";
import { Role } from "@/domain/auth/roles";
import { verifyCsrf } from "@/infrastructure/auth/csrf.guard";
import { ruleEvaluationService } from "@/application/alerts/rule-evaluation.service";
import { evaluateRangeSchema } from "@/application/alerts/alert.dto";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/wells/:id/telemetry/evaluate
 *
 * Evaluates telemetry readings within a bounded time window for a well.
 * Maximum 100 readings per evaluation to prevent unbounded processing.
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

    const { id: wellId } = await params;
    const body = await req.json().catch(() => ({}));

    const parsed = evaluateRangeSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const message = issue
        ? `${issue.path.join(".") || "payload"}: ${issue.message}`
        : "Invalid evaluation range parameters";
      throw AppError.validation(message, parsed.error.issues);
    }

    const result = await ruleEvaluationService.evaluateWellRange(
      wellId,
      parsed.data,
      user.id,
      user.role,
    );

    return successResponse(result, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
