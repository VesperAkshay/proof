/**
 * Image and Document Metadata Extraction Engine.
 * Extracts dimensions, page count, and structural metadata without native dependencies.
 * Enforces security-model.md §Upload security:
 * - Decompression bomb prevention (pixel cap)
 * - Metadata sanitization
 */

export const MAX_PIXEL_COUNT = 16_000_000; // 16 Megapixels (e.g. 4000 x 4000)

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface DocumentMetadata {
  mimeType: string;
  width?: number;
  height?: number;
  pageCount?: number;
  pdfVersion?: string;
  isDecompressionBomb: boolean;
}

/**
 * Extracts width and height from PNG buffer.
 */
export function extractPngDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 24) return null;
  // IHDR chunk starts at byte 12
  const chunkType = buffer.toString("ascii", 12, 16);
  if (chunkType !== "IHDR") return null;

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);

  return { width, height };
}

/**
 * Extracts width and height from JPEG buffer by scanning SOF markers.
 */
export function extractJpegDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  while (offset < buffer.length - 8) {
    if (buffer[offset] !== 0xff) {
      offset++;
      continue;
    }

    const marker = buffer[offset + 1];
    // SOF0 (0xC0) to SOF3 (0xC3), SOF5-SOF7, SOF9-SOF11, SOF13-SOF15
    if (
      marker !== undefined &&
      (marker === 0xc0 ||
        marker === 0xc1 ||
        marker === 0xc2 ||
        marker === 0xc3 ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf))
    ) {
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      return { width, height };
    }

    // Move to next marker
    if (offset + 3 >= buffer.length) break;
    const length = buffer.readUInt16BE(offset + 2);
    offset += 2 + length;
  }

  return null;
}

/**
 * Extracts width and height from WebP buffer (VP8 or VP8X).
 */
export function extractWebpDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 30) return null;

  const format = buffer.toString("ascii", 12, 16);
  if (format === "VP8X") {
    // VP8X width is 24-bit int at offset 24, height at 27
    const width = 1 + buffer.readUIntLE(24, 3);
    const height = 1 + buffer.readUIntLE(27, 3);
    return { width, height };
  } else if (format === "VP8 ") {
    // Keyframe header at offset 23
    const width = buffer.readUInt16LE(26) & 0x3fff;
    const height = buffer.readUInt16LE(28) & 0x3fff;
    return { width, height };
  }

  return null;
}

/**
 * Extracts page count and version from PDF buffer.
 */
export function extractPdfMetadata(buffer: Buffer): { pageCount: number; pdfVersion: string } {
  const header = buffer.subarray(0, 10).toString("ascii");
  const versionMatch = header.match(/%PDF-(\d+\.\d+)/);
  const pdfVersion = versionMatch ? versionMatch[1] || "1.4" : "1.4";

  const content = buffer.toString("latin1");

  // Attempt 1: Match /Count in Pages dictionary (e.g. /Count 3)
  const countMatches = [...content.matchAll(/\/Type\s*\/Pages\b[\s\S]*?\/Count\s+(\d+)/gi)];
  if (countMatches.length > 0) {
    const lastMatch = countMatches[countMatches.length - 1];
    if (lastMatch && lastMatch[1]) {
      const parsed = parseInt(lastMatch[1], 10);
      if (!isNaN(parsed) && parsed > 0) {
        return { pageCount: parsed, pdfVersion };
      }
    }
  }

  // Attempt 2: Count individual /Type /Page objects
  const pageMatches = [...content.matchAll(/\/Type\s*\/Page\b/gi)];
  const pageCount = Math.max(1, pageMatches.length);

  return { pageCount, pdfVersion };
}

/**
 * Extracts full metadata for an asset, enforcing decompression bomb limits.
 */
export function extractMetadata(buffer: Buffer, mimeType: string): DocumentMetadata {
  let width: number | undefined;
  let height: number | undefined;
  let pageCount: number | undefined;
  let pdfVersion: string | undefined;

  if (mimeType === "image/png") {
    const dims = extractPngDimensions(buffer);
    if (dims) {
      width = dims.width;
      height = dims.height;
    }
  } else if (mimeType === "image/jpeg") {
    const dims = extractJpegDimensions(buffer);
    if (dims) {
      width = dims.width;
      height = dims.height;
    }
  } else if (mimeType === "image/webp") {
    const dims = extractWebpDimensions(buffer);
    if (dims) {
      width = dims.width;
      height = dims.height;
    }
  } else if (mimeType === "application/pdf") {
    const pdfMeta = extractPdfMetadata(buffer);
    pageCount = pdfMeta.pageCount;
    pdfVersion = pdfMeta.pdfVersion;
  }

  const isDecompressionBomb =
    width !== undefined && height !== undefined && width * height > MAX_PIXEL_COUNT;

  return {
    mimeType,
    width,
    height,
    pageCount,
    pdfVersion,
    isDecompressionBomb,
  };
}
