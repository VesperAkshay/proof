/**
 * Slug generation, validation, and collision suggestion utilities.
 * Enforces data-model.md §proofs:
 * - CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) BETWEEN 1 AND 80)
 */

export const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const MAX_SLUG_LENGTH = 80;

/**
 * Normalizes an arbitrary string (e.g. title) into a valid URL slug.
 */
export function normalizeSlug(raw: string): string {
  if (!raw || typeof raw !== "string") {
    return "proof";
  }

  let slug = raw
    .toLowerCase()
    .trim()
    // Replace non-alphanumeric chars with hyphens
    .replace(/[^a-z0-9]+/g, "-")
    // Remove leading and trailing hyphens
    .replace(/^-+|-+$/g, "");

  if (!slug) {
    slug = "proof";
  }

  if (slug.length > MAX_SLUG_LENGTH) {
    slug = slug.slice(0, MAX_SLUG_LENGTH).replace(/-+$/, "");
  }

  return slug;
}

/**
 * Validates whether a slug conforms strictly to the format and length requirements.
 */
export function validateSlug(slug: string): boolean {
  if (!slug || typeof slug !== "string") {
    return false;
  }
  if (slug.length < 1 || slug.length > MAX_SLUG_LENGTH) {
    return false;
  }
  return SLUG_REGEX.test(slug);
}

/**
 * Generates alternative slug suggestions when a slug collision occurs.
 */
export function generateSlugSuggestions(baseSlug: string, count = 3): string[] {
  const normalized = normalizeSlug(baseSlug);
  const suggestions: string[] = [];

  for (let i = 2; i <= count + 1; i++) {
    const candidate = `${normalized}-${i}`;
    if (candidate.length <= MAX_SLUG_LENGTH) {
      suggestions.push(candidate);
    } else {
      // Truncate base to fit suffix
      const suffix = `-${i}`;
      const trimmedBase = normalized.slice(0, MAX_SLUG_LENGTH - suffix.length).replace(/-+$/, "");
      suggestions.push(`${trimmedBase}${suffix}`);
    }
  }

  return suggestions;
}
