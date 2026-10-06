import QRCode from "qrcode";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://proof.so";

/**
 * Returns the canonical Proof URL with QR scan tracking parameter.
 * Invariant per product-spec & M9: QR encodes canonical URL only, never document data.
 */
export function getCanonicalProofQrUrl(handle: string, slug: string): string {
  const cleanHandle = handle.replace(/^@/, "");
  return `${BASE_URL}/@${cleanHandle}/${slug}?ref=qr`;
}

/**
 * Generates vector SVG QR code string.
 */
export async function generateQrCodeSvg(
  url: string,
  options?: { margin?: number; width?: number }
): Promise<string> {
  return await QRCode.toString(url, {
    type: "svg",
    margin: options?.margin ?? 1,
    width: options?.width ?? 256,
    color: {
      dark: "#111111", // --color-ink
      light: "#00000000", // transparent
    },
  });
}

/**
 * Generates raster PNG QR code Buffer.
 */
export async function generateQrCodePng(
  url: string,
  options?: { margin?: number; width?: number }
): Promise<Buffer> {
  return await QRCode.toBuffer(url, {
    type: "png",
    margin: options?.margin ?? 1,
    width: options?.width ?? 512,
    color: {
      dark: "#111111", // --color-ink
      light: "#F4F1EA", // --color-paper
    },
  });
}
