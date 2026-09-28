import { NextRequest } from "next/server";
import { documentService } from "@/application/documents/document.service";
import { requireAuth } from "@/application/auth/guard";
import { successResponse, errorResponse } from "@/lib/response";

interface RouteParams {
  params: Promise<{ documentId: string }>;
}

/**
 * GET /api/v1/documents/:documentId/metadata
 * Retrieves detailed metadata for a specific document without downloading the file.
 *
 * RBAC: Accessible to all authenticated users (including VIEWER).
 * SECURITY: Never exposes physical storage keys, directory roots, or internal paths.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireAuth(req);
    const { documentId } = await params;

    const document = await documentService.getDocumentMetadata(
      documentId,
      user.id,
    );

    return successResponse({ document }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
