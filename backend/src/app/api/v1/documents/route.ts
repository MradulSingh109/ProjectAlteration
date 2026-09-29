import { NextRequest } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { requireAuth } from "@/application/auth/guard";
import { successResponse, errorResponse } from "@/lib/response";

/**
 * GET /api/v1/documents
 *
 * Global documents query endpoint.
 * Lists all uploaded, processed, and indexed drilling technical documents
 * across all wells, including extracted event counts.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);

    const rows = await prisma.document.findMany({
      orderBy: { uploadedAt: "desc" },
      include: {
        well: { select: { id: true, wellId: true, name: true, field: true } },
        _count: { select: { events: true } },
      },
    });

    const items = rows.map((d) => {
      const wellIdBusiness = d.well?.wellId || d.wellId;
      const statusStr =
        d.ingestionStatus === "COMPLETED"
          ? "indexed"
          : d.ingestionStatus === "PROCESSING"
          ? "extracting"
          : d.ingestionStatus === "PENDING"
          ? "uploaded"
          : "failed";

      return {
        id: d.id,
        documentId: d.id,
        document_id: d.id,
        filename: d.filename,
        documentType: d.documentType,
        type: d.documentType,
        mimeType: d.mimeType,
        fileSize: d.fileSize,
        wellId: wellIdBusiness,
        well_id: wellIdBusiness,
        wellName: d.well?.name || wellIdBusiness,
        status: statusStr,
        ingestionStatus: d.ingestionStatus,
        eventsExtracted: d._count.events,
        events_extracted: d._count.events,
        uploadedAt: d.uploadedAt.toISOString(),
      };
    });

    return successResponse({ documents: items, items }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
