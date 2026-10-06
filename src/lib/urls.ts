/**
 * URL sanitization and safe link extraction utilities.
 * Enforces security-model.md §Web security:
 * - External links from user content: rel="noopener noreferrer nofollow ugc"
 * - Only `https:` URLs accepted.
 */

/**
 * Validates whether a URL string is a valid, absolute HTTPS URL.
 * Rejects non-https protocols (http, javascript, data, file, etc.).
 */
export function sanitizeHttpsUrl(urlString: string | null | undefined): string | null {
  if (!urlString || typeof urlString !== "string") {
    return null;
  }

  const trimmed = urlString.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:") {
      return parsed.href;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extracts all unique, valid HTTPS URLs from freeform text (e.g. bio).
 */
export function extractSafeHttpsLinks(text: string | null | undefined): string[] {
  if (!text || typeof text !== "string") {
    return [];
  }

  // Match potential https URLs in text
  const urlRegex = /https:\/\/[^\s<>"'{}|\\^`[\]]+/gi;
  const matches = text.match(urlRegex) || [];

  const validUrls: string[] = [];
  const seen = new Set<string>();

  for (const match of matches) {
    // Strip trailing punctuation like period, comma, semicolon, question/exclamation, closing paren
    const cleaned = match.replace(/[.,;:!?)]+$/, "");
    const sanitized = sanitizeHttpsUrl(cleaned);
    if (sanitized && !seen.has(sanitized)) {
      seen.add(sanitized);
      validUrls.push(sanitized);
    }
  }

  return validUrls;
}

/**
 * Standard secure external link attributes for user-generated content.
 */
export const EXTERNAL_LINK_PROPS = {
  target: "_blank",
  rel: "noopener noreferrer nofollow ugc",
} as const;
