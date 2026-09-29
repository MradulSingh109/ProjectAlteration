import { NextRequest } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { requireAuth } from "@/application/auth/guard";
import { successResponse, errorResponse } from "@/lib/response";
import { EventType, EventSeverity } from "@/domain/events/drilling-event.entity";

/**
 * GET /api/v1/events
 *
 * Global drilling events query endpoint.
 * Supports cross-well event discovery, filtering, pagination, and schema normalization
 * compatible with both frontend EventExplorer and backend services.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);

    const searchParams = req.nextUrl.searchParams;
    const wellQuery = searchParams.get("wellId") || searchParams.get("well_id");
    const rawType = searchParams.get("type") || searchParams.get("eventType");
    const rawSeverity = searchParams.get("severity");
    const formation = searchParams.get("formation");
    const depthFrom = searchParams.get("depth_from") || searchParams.get("minDepthMd");
    const depthTo = searchParams.get("depth_to") || searchParams.get("maxDepthMd");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "50", 10)));

    const where: any = {};

    if (wellQuery) {
      // Check if wellQuery matches a UUID or a business wellId
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

    if (rawType) {
      const normalizedType = rawType.toUpperCase().replace(/\s+/g, "_");
      if (Object.values(EventType).includes(normalizedType as EventType)) {
        where.eventType = normalizedType;
      }
    }

    if (rawSeverity) {
      const normalizedSeverity = rawSeverity.toUpperCase();
      if (Object.values(EventSeverity).includes(normalizedSeverity as EventSeverity)) {
        where.severity = normalizedSeverity;
      }
    }

    if (formation) {
      where.formation = { contains: formation, mode: "insensitive" };
    }

    if (depthFrom || depthTo) {
      where.depthMd = {};
      if (depthFrom) where.depthMd.gte = parseFloat(depthFrom);
      if (depthTo) where.depthMd.lte = parseFloat(depthTo);
    }

    const [totalItems, rows] = await Promise.all([
      prisma.drillingEvent.count({ where }),
      prisma.drillingEvent.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { depthMd: "asc" },
        include: {
          well: { select: { id: true, wellId: true, name: true, field: true } },
          sourceDocument: { select: { id: true, filename: true, documentType: true } },
        },
      }),
    ]);

    const items = rows.map((r) => {
      const depth = Number(r.depthMd);
      const wellIdBusiness = r.well?.wellId || r.wellId;
      return {
        id: r.id,
        eventId: r.mlEventId || r.id,
        event_id: r.mlEventId || r.id,
        wellId: wellIdBusiness,
        well_id: wellIdBusiness,
        wellName: r.well?.name || wellIdBusiness,
        eventType: r.eventType,
        type: r.eventType.toLowerCase(),
        severity: r.severity.toLowerCase(),
        depthMd: depth,
        depth_md: depth,
        formation: r.formation || "Unknown",
        description: r.description,
        cause: r.cause,
        mitigation: r.mitigation,
        sourceDocumentId: r.sourceDocumentId,
        sourceDocument: r.sourceDocument?.filename,
        sourcePage: r.sourcePage,
        page: r.sourcePage,
        evidence: r.evidence || {
          document: r.sourceDocument?.filename,
          page: r.sourcePage,
          note: r.mitigation || r.description,
        },
        reviewStatus: r.reviewStatus,
        createdAt: r.createdAt.toISOString(),
      };
    });

    return successResponse(
      {
        events: items,
        items,
        pagination: {
          page,
          pageSize,
          totalItems,
          totalPages: Math.ceil(totalItems / pageSize),
        },
      },
      200,
    );
  } catch (error) {
    return errorResponse(error);
  }
}
