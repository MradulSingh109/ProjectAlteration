import { describe, it, expect } from "vitest";
import {
  validatePdfDocument,
  computeSha256,
} from "@/infrastructure/documents/pdf-validator";
import { config } from "@/config/env";

describe("PDF Validation & Cryptographic Hashing", () => {
  const validPdfHeader = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF");

  it("successfully validates a genuine PDF document with %PDF- header and .pdf extension", () => {
    const result = validatePdfDocument(
      validPdfHeader,
      "well_completion_report.pdf",
      "application/pdf",
    );

    expect(result.filename).toBe("well_completion_report.pdf");
    expect(result.mimeType).toBe("application/pdf");
    expect(result.fileSize).toBe(validPdfHeader.length);
    expect(result.fileHash).toBe(computeSha256(validPdfHeader));
  });

  it("is case-insensitive for .pdf extension (.PDF, .Pdf)", () => {
    const result = validatePdfDocument(validPdfHeader, "SURVEY_REPORT.PDF");
    expect(result.filename).toBe("SURVEY_REPORT.PDF");
  });

  it("rejects non-pdf extensions even if content contains valid PDF magic bytes", () => {
    expect(() =>
      validatePdfDocument(validPdfHeader, "payload.exe", "application/pdf"),
    ).toThrow(/Only \.pdf files are supported/i);

    expect(() => validatePdfDocument(validPdfHeader, "notes.txt")).toThrow(
      /Only \.pdf files are supported/i,
    );

    expect(() => validatePdfDocument(validPdfHeader, "report.pdf.exe")).toThrow(
      /Only \.pdf files are supported/i,
    );
  });

  it("rejects non-application/pdf MIME types", () => {
    expect(() =>
      validatePdfDocument(validPdfHeader, "valid.pdf", "image/png"),
    ).toThrow(/Only 'application\/pdf' is permitted/i);
  });

  it("rejects empty files (0 bytes)", () => {
    const emptyBuffer = Buffer.alloc(0);
    expect(() =>
      validatePdfDocument(emptyBuffer, "empty.pdf", "application/pdf"),
    ).toThrow(/Uploaded file is empty/i);
  });

  it("rejects files exceeding the maximum configured file size", () => {
    // Construct a buffer exceeding maxDocumentSizeBytes
    const maxBytes = config.storage.maxDocumentSizeBytes;
    const oversizedBuffer = Buffer.alloc(maxBytes + 1024);
    // Write valid magic bytes so it only fails size check
    Buffer.from("%PDF-").copy(oversizedBuffer);

    expect(() =>
      validatePdfDocument(oversizedBuffer, "large.pdf", "application/pdf"),
    ).toThrow(/exceeds maximum permitted limit/i);
  });

  it("rejects files claiming to be PDF but lacking %PDF- magic bytes", () => {
    const fakePdf = Buffer.from("This is plain text pretending to be a PDF");
    expect(() =>
      validatePdfDocument(fakePdf, "fake.pdf", "application/pdf"),
    ).toThrow(/lacks valid '%PDF-' magic bytes/i);

    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    expect(() =>
      validatePdfDocument(pngHeader, "fake_image.pdf", "application/pdf"),
    ).toThrow(/lacks valid '%PDF-' magic bytes/i);
  });

  it("computes identical SHA-256 hash for identical byte contents", () => {
    const content = Buffer.from("%PDF-1.7\nSample Drilling Data");
    const hash1 = computeSha256(content);
    const hash2 = computeSha256(content);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // 256-bit hex representation
  });

  it("computes different SHA-256 hashes for different byte contents", () => {
    const content1 = Buffer.from("%PDF-1.4\nWell A Log");
    const content2 = Buffer.from("%PDF-1.4\nWell B Log");

    expect(computeSha256(content1)).not.toBe(computeSha256(content2));
  });
});
