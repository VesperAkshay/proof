import { describe, it, expect } from "vitest";
import {
  getCanonicalProofQrUrl,
  generateQrCodeSvg,
  generateQrCodePng,
} from "../sharing";

describe("QR & Sharing Service (M9)", () => {
  it("generates canonical URL encoding ref=qr query param without leading @", () => {
    const urlWithAt = getCanonicalProofQrUrl("@akshay", "aws-solutions-architect");
    expect(urlWithAt).toBe("https://proof.so/@akshay/aws-solutions-architect?ref=qr");

    const urlWithoutAt = getCanonicalProofQrUrl("akshay", "aws-solutions-architect");
    expect(urlWithoutAt).toBe("https://proof.so/@akshay/aws-solutions-architect?ref=qr");
  });

  it("never includes document bytes or secrets in the encoded QR URL", () => {
    const url = getCanonicalProofQrUrl("akshay", "slug");
    expect(url).not.toMatch(/secret|key|token|s3|r2|bytes|quarantine/i);
    expect(url).toBe("https://proof.so/@akshay/slug?ref=qr");
  });

  it("generates scalable SVG vector QR code", async () => {
    const targetUrl = "https://proof.so/@akshay/aws-cert?ref=qr";
    const svg = await generateQrCodeSvg(targetUrl);

    expect(typeof svg).toBe("string");
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("#111111"); // --color-ink
  });

  it("generates raster PNG QR code with valid PNG magic header", async () => {
    const targetUrl = "https://proof.so/@akshay/aws-cert?ref=qr";
    const pngBuffer = await generateQrCodePng(targetUrl);

    expect(Buffer.isBuffer(pngBuffer)).toBe(true);
    expect(pngBuffer.length).toBeGreaterThan(100);

    // Verify standard PNG magic bytes: 0x89 'P' 'N' 'G' 0x0D 0x0A 0x1A 0x0A
    expect(pngBuffer[0]).toBe(0x89);
    expect(pngBuffer[1]).toBe(0x50); // P
    expect(pngBuffer[2]).toBe(0x4e); // N
    expect(pngBuffer[3]).toBe(0x47); // G
  });
});
