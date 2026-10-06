import crypto from "crypto";

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB per security-model.md

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const MIME_EXTENSION_MAP: Record<AllowedMimeType, string[]> = {
  "application/pdf": [".pdf"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
};

export interface FileValidationResult {
  isValid: boolean;
  detectedMimeType: AllowedMimeType | null;
  sha256: string;
  rejectionReason?: string;
}

/**
 * Validates filename extension against declared MIME type.
 * Rejects path traversal and dangerous extensions (svg, html, exe, etc.).
 */
export function validateFilenameAndMime(
  filename: string,
  declaredMimeType: string
): { isValid: boolean; error?: string } {
  if (!filename || typeof filename !== "string") {
    return { isValid: false, error: "Filename is required" };
  }

  // Sanitize path traversal
  if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
    return { isValid: false, error: "Filename must not contain path traversal characters" };
  }

  if (!ALLOWED_MIME_TYPES.includes(declaredMimeType as AllowedMimeType)) {
    return {
      isValid: false,
      error: `Unsupported MIME type: '${declaredMimeType}'. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`,
    };
  }

  const extMatch = filename.toLowerCase().match(/\.[a-z0-9]+$/);
  if (!extMatch) {
    return { isValid: false, error: "File must have a valid extension" };
  }

  const ext = extMatch[0];
  const allowedExtensions = MIME_EXTENSION_MAP[declaredMimeType as AllowedMimeType];
  if (!allowedExtensions.includes(ext)) {
    return {
      isValid: false,
      error: `Extension '${ext}' does not match declared MIME type '${declaredMimeType}'`,
    };
  }

  return { isValid: true };
}

/**
 * Detects MIME type from buffer magic bytes.
 */
export function detectMagicBytes(buffer: Buffer): AllowedMimeType | null {
  if (buffer.length < 4) return null;

  // PDF: %PDF- (0x25 0x50 0x44 0x46 0x2D)
  if (
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    return "application/pdf";
  }

  // PNG: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  // JPEG: 0xFF 0xD8 0xFF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  // WebP: RIFF .... WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 && // RIFF
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50 // WEBP
  ) {
    return "image/webp";
  }

  return null;
}

/**
 * Inspects PDF buffers for structural integrity and forbidden active content (/JavaScript, /Launch).
 * Per security-model.md §Upload security:
 * "reject PDFs with embedded JavaScript/launch actions/embedded files"
 */
export function auditPdfStructure(buffer: Buffer): { isValid: boolean; error?: string } {
  // Must end with %%EOF or have %%EOF in last 1024 bytes
  const tail = buffer.subarray(Math.max(0, buffer.length - 1024)).toString("latin1");
  if (!tail.includes("%%EOF")) {
    return { isValid: false, error: "Corrupt or truncated PDF: missing %%EOF marker" };
  }

  const content = buffer.toString("latin1");

  // Check for forbidden active content
  if (content.includes("/JavaScript") || content.includes("/JS")) {
    return { isValid: false, error: "PDF rejected: embedded JavaScript actions detected" };
  }
  if (content.includes("/Launch")) {
    return { isValid: false, error: "PDF rejected: embedded Launch actions detected" };
  }
  if (content.includes("/EmbeddedFiles")) {
    return { isValid: false, error: "PDF rejected: embedded foreign files detected" };
  }

  return { isValid: true };
}

/**
 * EICAR standard test signature check.
 */
const EICAR_SIGNATURE = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

export interface MalwareScanResult {
  isClean: boolean;
  reason?: string;
}

export interface MalwareScanner {
  scanBuffer(buffer: Buffer): Promise<MalwareScanResult>;
}

export class DefaultMalwareScanner implements MalwareScanner {
  async scanBuffer(buffer: Buffer): Promise<MalwareScanResult> {
    const text = buffer.toString("utf8", 0, Math.min(buffer.length, 4096));
    if (text.includes(EICAR_SIGNATURE)) {
      return { isClean: false, reason: "EICAR antivirus test signature detected" };
    }
    return { isClean: true };
  }
}

/**
 * Validates uploaded file bytes: size, magic bytes, PDF structure, malware scan, and sha256 checksum.
 */
export async function validateUploadedBytes(
  buffer: Buffer,
  declaredMimeType: string,
  scanner: MalwareScanner = new DefaultMalwareScanner()
): Promise<FileValidationResult> {
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

  // 1. Size Check
  if (buffer.length === 0) {
    return { isValid: false, detectedMimeType: null, sha256, rejectionReason: "File is empty (0 bytes)" };
  }
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return {
      isValid: false,
      detectedMimeType: null,
      sha256,
      rejectionReason: `File exceeds maximum allowed size of 10 MB (${buffer.length} bytes)`,
    };
  }

  // 2. Magic Bytes Check
  const detectedMime = detectMagicBytes(buffer);
  if (!detectedMime) {
    return {
      isValid: false,
      detectedMimeType: null,
      sha256,
      rejectionReason: "Unrecognized file signature (magic bytes do not match any allowed format)",
    };
  }

  if (detectedMime !== declaredMimeType) {
    return {
      isValid: false,
      detectedMimeType: detectedMime,
      sha256,
      rejectionReason: `MIME type mismatch: declared '${declaredMimeType}' but detected '${detectedMime}'`,
    };
  }

  // 3. PDF Structural Audit
  if (detectedMime === "application/pdf") {
    const pdfAudit = auditPdfStructure(buffer);
    if (!pdfAudit.isValid) {
      return {
        isValid: false,
        detectedMimeType: detectedMime,
        sha256,
        rejectionReason: pdfAudit.error || "Invalid PDF structure",
      };
    }
  }

  // 4. Malware Scan
  const scanResult = await scanner.scanBuffer(buffer);
  if (!scanResult.isClean) {
    return {
      isValid: false,
      detectedMimeType: detectedMime,
      sha256,
      rejectionReason: scanResult.reason || "Malicious content detected by antivirus scanner",
    };
  }

  return {
    isValid: true,
    detectedMimeType: detectedMime,
    sha256,
  };
}
