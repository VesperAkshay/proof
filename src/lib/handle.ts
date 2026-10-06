/**
 * Pure handle normalization and validation utilities (M2.3, M2.6, M2.13)
 * Guarantees case-insensitivity, anti-homograph protection, and canonical handle format.
 */

export const HANDLE_REGEX = /^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$/;

export type HandleValidationResult = {
  isValid: boolean;
  normalized: string;
  reason?: "TOO_SHORT" | "TOO_LONG" | "START_OR_END_SEPARATOR" | "INVALID_CHARACTERS";
  message?: string;
};

/**
 * Normalizes a raw user input into a canonical handle string.
 * Strips leading '@', trims leading/trailing whitespace, and converts to lowercase.
 */
export function normalizeHandle(rawInput: string): string {
  if (!rawInput) return "";
  let clean = rawInput.trim();
  if (clean.startsWith("@")) {
    clean = clean.slice(1);
  }
  return clean.toLowerCase();
}

/**
 * Validates a handle against canonical proof format:
 * - 3 to 30 characters
 * - Only ASCII [a-z0-9_-] (homograph safe)
 * - Cannot start or end with a hyphen or underscore
 */
export function validateHandle(rawInput: string): HandleValidationResult {
  const normalized = normalizeHandle(rawInput);

  if (normalized.length < 3) {
    return {
      isValid: false,
      normalized,
      reason: "TOO_SHORT",
      message: "Handle must be at least 3 characters long.",
    };
  }

  if (normalized.length > 30) {
    return {
      isValid: false,
      normalized,
      reason: "TOO_LONG",
      message: "Handle cannot exceed 30 characters.",
    };
  }

  if (
    normalized.startsWith("-") ||
    normalized.startsWith("_") ||
    normalized.endsWith("-") ||
    normalized.endsWith("_")
  ) {
    return {
      isValid: false,
      normalized,
      reason: "START_OR_END_SEPARATOR",
      message: "Handle cannot start or end with a hyphen or underscore.",
    };
  }

  if (!HANDLE_REGEX.test(normalized)) {
    return {
      isValid: false,
      normalized,
      reason: "INVALID_CHARACTERS",
      message: "Handle can only contain lowercase letters, numbers, hyphens, and underscores.",
    };
  }

  return {
    isValid: true,
    normalized,
  };
}

/**
 * Generates 3 canonical handle suggestions when a requested handle is taken or reserved.
 */
export async function generateHandleSuggestions(
  baseHandle: string,
  isAvailableFn: (candidate: string) => Promise<boolean> | boolean
): Promise<string[]> {
  const normalized = normalizeHandle(baseHandle).replace(/[^a-z0-9]/g, "");
  const root = normalized.slice(0, 20) || "user";
  const year = new Date().getFullYear();

  const candidateTemplates = [
    `${root}dev`,
    `${root}-proof`,
    `${root}hq`,
    `${root}${year}`,
    `${root}-io`,
    `${root}app`,
    `get${root}`,
    `real${root}`,
  ];

  const suggestions: string[] = [];

  for (const candidate of candidateTemplates) {
    if (suggestions.length >= 3) break;
    const validCheck = validateHandle(candidate);
    if (validCheck.isValid) {
      const available = await isAvailableFn(validCheck.normalized);
      if (available) {
        suggestions.push(validCheck.normalized);
      }
    }
  }

  return suggestions;
}
