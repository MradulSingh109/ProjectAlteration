import { NextRequest } from "next/server";
import { requireAuth } from "@/application/auth/guard";
import { alertLifecycleService } from "@/application/alerts/alert-lifecycle.service";
import { queryAlertsSchema } from "@/application/alerts/alert.dto";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/wells/:id/alerts
 *
 * Lists and filters alerts associated with a specific well.
 * Supports status, severity, alertType, ruleCode, and date range filtering.
 *
 * RBAC: Accessible to all authenticated users (VIEWER, GEOLOGIST, DRILLING_ENGINEER, ADMIN).
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth(req);
    const { id: wellId } = await params;

    const queryParams: Record<string, string> = {};
    req.nextUrl.searchParams.forEach((val, key) => {
      queryParams[key] = val;
    });

    const parsed = queryAlertsSchema.safeParse(queryParams);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const message = issue
        ? `${issue.path.join(".") || "query"}: ${issue.message}`
        : "Invalid query parameters";
      throw AppError.validation(message, parsed.error.issues);
    }

    const result = await alertLifecycleService.listAlertsForWell(
      wellId,
      parsed.data,
    );

    return successResponse(
      {
        wellId,
        items: result.items,
        pagination: result.pagination,
      },
      200,
    );
  } catch (error) {
    return errorResponse(error);
  }
}
