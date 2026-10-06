import { describe, it, expect } from "vitest";
import {
  extractPngDimensions,
  extractJpegDimensions,
  extractWebpDimensions,
  extractPdfMetadata,
  extractMetadata,
  MAX_PIXEL_COUNT,
} from "../metadata";

describe("Metadata & Dimensions Extraction Engine (M6)", () => {
  describe("extractPngDimensions", () => {
    it("extracts width and height from PNG IHDR chunk", () => {
      // Construct minimal PNG header with IHDR: 800 x 600
      const png = Buffer.alloc(30);
      // PNG signature
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png, 0);
      // Chunk length: 13
      png.writeUInt32BE(13, 8);
      // Chunk type: IHDR
      png.write("IHDR", 12, "ascii");
      // Width: 800
      png.writeUInt32BE(800, 16);
      // Height: 600
      png.writeUInt32BE(600, 20);

      const dims = extractPngDimensions(png);
      expect(dims).toEqual({ width: 800, height: 600 });
    });

    it("returns null for truncated buffer", () => {
      expect(extractPngDimensions(Buffer.alloc(10))).toBeNull();
    });
  });

  describe("extractJpegDimensions", () => {
    it("extracts width and height from SOF0 marker", () => {
      // JPEG SOI + SOF0 marker: 1024 x 768
      const jpeg = Buffer.alloc(20);
      jpeg[0] = 0xff;
      jpeg[1] = 0xd8; // SOI
      jpeg[2] = 0xff;
      jpeg[3] = 0xc0; // SOF0
      jpeg.writeUInt16BE(15, 4); // Length
      jpeg[6] = 8; // Precision
      jpeg.writeUInt16BE(768, 7); // Height
      jpeg.writeUInt16BE(1024, 9); // Width

      const dims = extractJpegDimensions(jpeg);
      expect(dims).toEqual({ width: 1024, height: 768 });
    });
  });

  describe("extractWebpDimensions", () => {
    it("extracts width and height from WebP VP8X chunk", () => {
      const webp = Buffer.alloc(35);
      Buffer.from("RIFF").copy(webp, 0);
      Buffer.from("WEBP").copy(webp, 8);
      Buffer.from("VP8X").copy(webp, 12);
      // Width (offset 24, 24-bit little endian, +1): 1920 - 1 = 1919
      webp.writeUIntLE(1919, 24, 3);
      // Height (offset 27, 24-bit little endian, +1): 1080 - 1 = 1079
      webp.writeUIntLE(1079, 27, 3);

      const dims = extractWebpDimensions(webp);
      expect(dims).toEqual({ width: 1920, height: 1080 });
    });
  });

  describe("extractPdfMetadata", () => {
    it("extracts PDF version and page count", () => {
      const pdf = Buffer.from(
        "%PDF-1.7\n1 0 obj\n<< /Type /Pages /Count 5 >>\nendobj\n%%EOF"
      );
      const meta = extractPdfMetadata(pdf);
      expect(meta.pdfVersion).toBe("1.7");
      expect(meta.pageCount).toBe(5);
    });

    it("defaults to 1 page if /Count is absent but valid PDF", () => {
      const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Page >>\nendobj\n%%EOF");
      const meta = extractPdfMetadata(pdf);
      expect(meta.pdfVersion).toBe("1.4");
      expect(meta.pageCount).toBe(1);
    });
  });

  describe("Decompression Bomb Prevention", () => {
    it("flags image exceeding MAX_PIXEL_COUNT as decompression bomb", () => {
      const hugePng = Buffer.alloc(30);
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(hugePng, 0);
      hugePng.write("IHDR", 12, "ascii");
      // 5000 x 5000 = 25,000,000 pixels > 16,000,000
      hugePng.writeUInt32BE(5000, 16);
      hugePng.writeUInt32BE(5000, 20);

      const meta = extractMetadata(hugePng, "image/png");
      expect(meta.isDecompressionBomb).toBe(true);
      expect(meta.width).toBe(5000);
      expect(meta.height).toBe(5000);
      expect(meta.width! * meta.height!).toBeGreaterThan(MAX_PIXEL_COUNT);
    });

    it("passes normal resolution image below threshold", () => {
      const normalPng = Buffer.alloc(30);
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(normalPng, 0);
      normalPng.write("IHDR", 12, "ascii");
      normalPng.writeUInt32BE(1920, 16);
      normalPng.writeUInt32BE(1080, 20);

      const meta = extractMetadata(normalPng, "image/png");
      expect(meta.isDecompressionBomb).toBe(false);
    });
  });
});
