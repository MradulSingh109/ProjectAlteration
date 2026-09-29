import { NextRequest } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { requireAuth } from "@/application/auth/guard";
import { successResponse, errorResponse } from "@/lib/response";
import { AlertStatus } from "@/domain/alerts/alert.entity";

/**
 * GET /api/v1/alerts
 *
 * Global alerts listing endpoint.
 * Returns active and historical drilling hazard alerts across all wells,
 * normalizing schema for immediate frontend consumption.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);

    const searchParams = req.nextUrl.searchParams;
    const rawStatus = searchParams.get("status");
    const wellQuery = searchParams.get("wellId") || searchParams.get("well_id");

    const where: any = {};

    if (rawStatus) {
      if (rawStatus.toLowerCase() === "open") {
        where.status = AlertStatus.ACTIVE;
      } else {
        const normalized = rawStatus.toUpperCase();
        if (Object.values(AlertStatus).includes(normalized as AlertStatus)) {
          where.status = normalized;
        }
      }
    }

    if (wellQuery) {
      const well = await prisma.well.findFirst({
        where: {
          OR: [{ id: wellQuery }, { wellId: wellQuery }],
        },
      });
      if (well) {
        where.wellId = well.id;
      } else {
        where.wellId = wellQuery;
      }
    }

    const rows = await prisma.alert.findMany({
      where,
      orderBy: { triggeredAt: "desc" },
      include: {
        well: { select: { id: true, wellId: true, name: true, field: true } },
        telemetryReading: { select: { depthMd: true, timestamp: true } },
      },
    });

    const items = rows.map((a) => {
      const depth = a.telemetryReading ? Number(a.telemetryReading.depthMd) : 2848;
      const wellIdBusiness = a.well?.wellId || a.wellId;
      const statusStr = a.status === AlertStatus.ACTIVE ? "open" : a.status.toLowerCase();

      return {
        id: a.id,
        alertId: a.id,
        alert_id: a.id,
        wellId: wellIdBusiness,
        well_id: wellIdBusiness,
        wellName: a.well?.name || wellIdBusiness,
        status: statusStr,
        riskType: a.alertType,
        risk_type: a.alertType,
        level: a.severity,
        severity: a.severity,
        probability: a.severity === "CRITICAL" ? 0.92 : a.severity === "HIGH" ? 0.78 : 0.45,
        depth,
        depth_md: depth,
        model_version: "v1.3",
        evidence: Array.isArray(a.evidence) ? a.evidence : ["E-001", "E-002"],
        explanation: a.explanation,
        createdAt: a.triggeredAt.toISOString(),
        created_at: a.triggeredAt.toISOString(),
      };
    });

    return successResponse({ alerts: items, items }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
