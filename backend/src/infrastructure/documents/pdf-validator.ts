import * as crypto from "crypto";
import { config } from "@/config/env";
import { AppError } from "@/lib/errors";

/**
 * Standard PDF magic byte sequence: '%PDF-' (0x25, 0x50, 0x44, 0x46, 0x2D).
 */
const PDF_MAGIC_BYTES = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]);

export interface ValidatedPdf {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  fileSize: number;
  fileHash: string;
}

/**
 * Validates that an uploaded payload is a genuine, non-empty PDF document adhering
 * to strict extension, MIME type, file size, and magic-byte specifications.
 *
 * @param buffer Raw uploaded file buffer
 * @param originalFilename Client-supplied filename (used for extension check and metadata)
 * @param clientMimeType Client-supplied MIME type
 * @returns Validated metadata including server-computed SHA-256 hash
 * @throws AppError 400 VALIDATION_ERROR on any validation failure
 */
export function validatePdfDocument(
  buffer: Buffer,
  originalFilename: string,
  clientMimeType?: string,
): ValidatedPdf {
  // 1. Filename presence and extension validation
  if (!originalFilename || typeof originalFilename !== "string") {
    throw AppError.validation("Filename is required", "MISSING_FILENAME");
  }

  const cleanFilename = originalFilename.trim();
  if (cleanFilename === "") {
    throw AppError.validation("Filename cannot be empty", "INVALID_FILENAME");
  }

  const lowerFilename = cleanFilename.toLowerCase();
  if (!lowerFilename.endsWith(".pdf")) {
    throw AppError.validation(
      "Invalid file extension. Only .pdf files are supported",
      "INVALID_FILE_EXTENSION",
    );
  }

  // 2. MIME type validation (must be application/pdf)
  if (clientMimeType) {
    const normalizedMime = clientMimeType.trim().toLowerCase();
    if (normalizedMime !== "application/pdf") {
      throw AppError.validation(
        `Invalid MIME type '${clientMimeType}'. Only 'application/pdf' is permitted`,
        "INVALID_MIME_TYPE",
      );
    }
  }

  // 3. File existence and non-empty check
  if (!buffer || buffer.length === 0) {
    throw AppError.validation(
      "Uploaded file is empty (0 bytes). Drilling documents must contain valid content",
      "EMPTY_FILE",
    );
  }

  // 4. File size validation against configured maximum
  const maxBytes = config.storage.maxDocumentSizeBytes;
  if (buffer.length > maxBytes) {
    throw AppError.validation(
      `File size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds maximum permitted limit of ${config.storage.maxDocumentSizeMb} MB`,
      "FILE_TOO_LARGE",
    );
  }

  // 5. PDF magic bytes inspection (%PDF-)
  if (buffer.length < PDF_MAGIC_BYTES.length) {
    throw AppError.validation(
      "File header is corrupt or incomplete. Valid PDF signature not found",
      "INVALID_PDF_HEADER",
    );
  }

  const fileHeader = buffer.subarray(0, PDF_MAGIC_BYTES.length);
  if (!fileHeader.equals(PDF_MAGIC_BYTES)) {
    throw AppError.validation(
      "File content signature mismatch. File claims to be a PDF but lacks valid '%PDF-' magic bytes",
      "INVALID_PDF_MAGIC_BYTES",
    );
  }

  // 6. Server-side SHA-256 hash computation
  const fileHash = computeSha256(buffer);

  return {
    buffer,
    filename: cleanFilename,
    mimeType: "application/pdf",
    fileSize: buffer.length,
    fileHash,
  };
}

/**
 * Computes cryptographically secure SHA-256 hash for document integrity and duplicate detection.
 */
export function computeSha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}
