import { NextRequest } from "next/server";
import { documentService } from "@/application/documents/document.service";
import { requireAuth } from "@/application/auth/guard";
import { Role } from "@/domain/auth/roles";
import {
  DocumentType,
  IngestionStatus,
} from "@/domain/documents/document.entity";
import { queryDocumentsSchema } from "@/application/documents/document.dto";
import { verifyCsrf } from "@/infrastructure/auth/csrf.guard";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/wells/:id/documents
 * Secure multipart PDF document upload endpoint.
 *
 * RBAC: Restricted to operational engineering roles (ADMIN, DRILLING_ENGINEER, GEOLOGIST).
 * VIEWER role is strictly forbidden.
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

    // 1. Parse multipart form data
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      throw AppError.validation(
        "Request body must be multipart/form-data with 'file' and 'documentType' fields",
        "INVALID_MULTIPART_REQUEST",
      );
    }

    // 2. Extract and validate required fields
    const rawFile = formData.get("file");
    if (!rawFile || typeof rawFile === "string" || !(rawFile instanceof Blob)) {
      throw AppError.validation(
        "A valid document file is required in 'file' form field",
        "MISSING_FILE",
      );
    }

    const rawDocumentType = formData.get("documentType");
    if (!rawDocumentType || typeof rawDocumentType !== "string") {
      throw AppError.validation(
        "Parameter 'documentType' is required as a string",
        "MISSING_DOCUMENT_TYPE",
      );
    }

    // 3. Read binary file contents
    const arrayBuffer = await rawFile.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    const originalFilename = (rawFile as File).name || "unnamed_document.pdf";
    const clientMimeType = rawFile.type || "application/pdf";

    // 4. Delegate to application service
    const document = await documentService.uploadDocument({
      wellId,
      fileBuffer,
      originalFilename,
      clientMimeType,
      documentType: rawDocumentType.trim(),
      userId: user.id,
    });

    return successResponse({ document }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * GET /api/v1/wells/:id/documents
 * Retrieves historical document metadata associated with the specified well.
 *
 * RBAC: Accessible to all authenticated users (including VIEWER).
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth(req);
    const { id: wellId } = await params;

    const searchParams = req.nextUrl.searchParams;
    const rawQuery: Record<string, string> = {};
    if (searchParams.has("documentType")) {
      rawQuery.documentType = searchParams.get("documentType")!;
    }
    if (searchParams.has("ingestionStatus")) {
      rawQuery.ingestionStatus = searchParams.get("ingestionStatus")!;
    }

    const parsed = queryDocumentsSchema.safeParse(rawQuery);
    if (!parsed.success) {
      throw AppError.validation(
        parsed.error.issues[0]?.message || "Invalid query parameters",
        parsed.error.issues,
      );
    }

    const documents = await documentService.listDocumentsByWell(
      wellId,
      parsed.data,
    );

    return successResponse({ documents }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
