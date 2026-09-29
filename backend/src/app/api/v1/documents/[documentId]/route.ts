import { NextRequest, NextResponse } from "next/server";
import { documentService } from "@/application/documents/document.service";
import { requireAuth } from "@/application/auth/guard";
import { errorResponse } from "@/lib/response";

interface RouteParams {
  params: Promise<{ documentId: string }>;
}

/**
 * GET /api/v1/documents/:documentId
 * Securely streams the requested technical PDF document.
 *
 * RBAC: Accessible to all authenticated users (including VIEWER).
 * SECURITY:
 * - Physical paths are never accepted from clients or leaked in headers.
 * - Enforces application/pdf Content-Type and nosniff protection.
 * - Retrieval is routed exclusively via the storage abstraction using database-resolved keys.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireAuth(req);
    const { documentId } = await params;

    const file = await documentService.getDocumentFile(documentId, user.id);

    // Sanitize filename for Content-Disposition header (prevent header injection)
    const sanitizedFilename = file.filename.replace(/["\r\n\\]/g, "_").trim();

    return new NextResponse(file.buffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": file.fileSize.toString(),
        "Content-Disposition": `inline; filename="${sanitizedFilename}"`,
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
