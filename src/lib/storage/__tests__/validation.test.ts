import { describe, it, expect } from "vitest";
import {
  validateFilenameAndMime,
  detectMagicBytes,
  auditPdfStructure,
  validateUploadedBytes,
  MAX_FILE_SIZE_BYTES,
  DefaultMalwareScanner,
} from "../validation";

describe("Storage Validation Engine (M5 Exit Gate)", () => {
  // Sample valid byte sequences
  const validPdfBytes = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF");
  const validPngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  const validJpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  const validWebpBytes = Buffer.from([
    0x52, 0x49, 0x46, 0x46, 0x18, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38,
  ]);

  describe("Extension & Declared MIME Validation", () => {
    it("accepts supported extensions matching declared MIME", () => {
      expect(validateFilenameAndMime("certificate.pdf", "application/pdf").isValid).toBe(true);
      expect(validateFilenameAndMime("badge.png", "image/png").isValid).toBe(true);
      expect(validateFilenameAndMime("photo.jpg", "image/jpeg").isValid).toBe(true);
      expect(validateFilenameAndMime("photo.jpeg", "image/jpeg").isValid).toBe(true);
      expect(validateFilenameAndMime("scan.webp", "image/webp").isValid).toBe(true);
    });

    it("rejects invalid extensions (svg, html, exe, zip, sh)", () => {
      expect(validateFilenameAndMime("vector.svg", "image/svg+xml").isValid).toBe(false);
      expect(validateFilenameAndMime("page.html", "text/html").isValid).toBe(false);
      expect(validateFilenameAndMime("payload.exe", "application/x-msdownload").isValid).toBe(false);
      expect(validateFilenameAndMime("archive.zip", "application/zip").isValid).toBe(false);
    });

    it("rejects extension / MIME mismatches", () => {
      const res = validateFilenameAndMime("certificate.pdf", "image/png");
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("does not match declared MIME");
    });

    it("rejects path traversal in filename", () => {
      expect(validateFilenameAndMime("../secret.pdf", "application/pdf").isValid).toBe(false);
      expect(validateFilenameAndMime("subdir/file.pdf", "application/pdf").isValid).toBe(false);
      expect(validateFilenameAndMime("..\\win.pdf", "application/pdf").isValid).toBe(false);
    });
  });

  describe("Magic Byte Detection", () => {
    it("detects PDF magic bytes (%PDF-)", () => {
      expect(detectMagicBytes(validPdfBytes)).toBe("application/pdf");
    });

    it("detects PNG magic bytes", () => {
      expect(detectMagicBytes(validPngBytes)).toBe("image/png");
    });

    it("detects JPEG magic bytes", () => {
      expect(detectMagicBytes(validJpegBytes)).toBe("image/jpeg");
    });

    it("detects WebP magic bytes (RIFF ... WEBP)", () => {
      expect(detectMagicBytes(validWebpBytes)).toBe("image/webp");
    });

    it("returns null for arbitrary or unknown bytes", () => {
      const unknown = Buffer.from("Hello world, this is a plain text file");
      expect(detectMagicBytes(unknown)).toBeNull();
    });
  });

  describe("PDF Structural Audit", () => {
    it("passes well-formed PDF with %%EOF trailer", () => {
      expect(auditPdfStructure(validPdfBytes).isValid).toBe(true);
    });

    it("rejects corrupt or truncated PDF without %%EOF", () => {
      const truncated = Buffer.from("%PDF-1.4\nSome random content without eof");
      const res = auditPdfStructure(truncated);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("Corrupt or truncated PDF");
    });

    it("rejects PDF containing embedded /JavaScript actions", () => {
      const jsPdf = Buffer.from(
        "%PDF-1.4\n<< /Type /Action /S /JavaScript /JS (app.alert(1);) >>\n%%EOF"
      );
      const res = auditPdfStructure(jsPdf);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("embedded JavaScript actions detected");
    });

    it("rejects PDF containing embedded /Launch actions", () => {
      const launchPdf = Buffer.from(
        "%PDF-1.4\n<< /Type /Action /S /Launch /F (cmd.exe) >>\n%%EOF"
      );
      const res = auditPdfStructure(launchPdf);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("embedded Launch actions detected");
    });

    it("rejects PDF containing embedded foreign files", () => {
      const embeddedPdf = Buffer.from(
        "%PDF-1.4\n<< /EmbeddedFiles << /Names [] >> >>\n%%EOF"
      );
      const res = auditPdfStructure(embeddedPdf);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("embedded foreign files detected");
    });
  });

  describe("Full validateUploadedBytes Pipeline", () => {
    it("validates all 4 allowed formats: PDF, PNG, JPEG, WebP", async () => {
      const pdfRes = await validateUploadedBytes(validPdfBytes, "application/pdf");
      expect(pdfRes.isValid).toBe(true);
      expect(pdfRes.detectedMimeType).toBe("application/pdf");
      expect(pdfRes.sha256).toBeDefined();

      const pngRes = await validateUploadedBytes(validPngBytes, "image/png");
      expect(pngRes.isValid).toBe(true);
      expect(pngRes.detectedMimeType).toBe("image/png");

      const jpegRes = await validateUploadedBytes(validJpegBytes, "image/jpeg");
      expect(jpegRes.isValid).toBe(true);
      expect(jpegRes.detectedMimeType).toBe("image/jpeg");

      const webpRes = await validateUploadedBytes(validWebpBytes, "image/webp");
      expect(webpRes.isValid).toBe(true);
      expect(webpRes.detectedMimeType).toBe("image/webp");
    });

    it("rejects wrong MIME (declared PDF but actually PNG)", async () => {
      const res = await validateUploadedBytes(validPngBytes, "application/pdf");
      expect(res.isValid).toBe(false);
      expect(res.rejectionReason).toContain("MIME type mismatch");
    });

    it("rejects oversized file (> 10MB)", async () => {
      const oversized = Buffer.alloc(MAX_FILE_SIZE_BYTES + 1, 0x41);
      const res = await validateUploadedBytes(oversized, "application/pdf");
      expect(res.isValid).toBe(false);
      expect(res.rejectionReason).toContain("exceeds maximum allowed size");
    });

    it("rejects empty file (0 bytes)", async () => {
      const empty = Buffer.alloc(0);
      const res = await validateUploadedBytes(empty, "application/pdf");
      expect(res.isValid).toBe(false);
      expect(res.rejectionReason).toContain("File is empty");
    });

    it("rejects malicious file with EICAR antivirus test signature", async () => {
      const eicarPayload = Buffer.from(
        "%PDF-1.4\nX5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*\n%%EOF"
      );
      const res = await validateUploadedBytes(eicarPayload, "application/pdf", new DefaultMalwareScanner());
      expect(res.isValid).toBe(false);
      expect(res.rejectionReason).toContain("EICAR antivirus test signature detected");
    });
  });
});
