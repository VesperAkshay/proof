import { describe, it, expect } from "vitest";
import {
  normalizeSlug,
  validateSlug,
  generateSlugSuggestions,
  SLUG_REGEX,
} from "../slug";

describe("slug utility (M4)", () => {
  describe("normalizeSlug", () => {
    it("converts titles to lowercase hyphens", () => {
      expect(normalizeSlug("AWS Solutions Architect")).toBe("aws-solutions-architect");
      expect(normalizeSlug("Master's Degree in Computer Science")).toBe("master-s-degree-in-computer-science");
    });

    it("collapses multiple spaces and symbols", () => {
      expect(normalizeSlug("Web3  &   Blockchain --- Hackathon #1")).toBe("web3-blockchain-hackathon-1");
    });

    it("strips edge hyphens", () => {
      expect(normalizeSlug("---hello-world---")).toBe("hello-world");
    });

    it("falls back to 'proof' for empty or non-alphanumeric strings", () => {
      expect(normalizeSlug("")).toBe("proof");
      expect(normalizeSlug("!@#$%^&*()")).toBe("proof");
    });

    it("enforces maximum length of 80 characters without trailing hyphen", () => {
      const veryLong = "a".repeat(100);
      const normalized = normalizeSlug(veryLong);
      expect(normalized.length).toBeLessThanOrEqual(80);
      expect(normalized.endsWith("-")).toBe(false);
    });
  });

  describe("validateSlug", () => {
    it("accepts valid alphanumeric hyphens slugs", () => {
      expect(validateSlug("aws-csa")).toBe(true);
      expect(validateSlug("cert")).toBe(true);
      expect(validateSlug("hackathon-2026-winner")).toBe(true);
    });

    it("rejects invalid slugs", () => {
      expect(validateSlug("")).toBe(false);
      expect(validateSlug("-leading")).toBe(false);
      expect(validateSlug("trailing-")).toBe(false);
      expect(validateSlug("double--hyphen")).toBe(false);
      expect(validateSlug("UPPERCASE")).toBe(false);
      expect(validateSlug("with space")).toBe(false);
      expect(validateSlug("special!char")).toBe(false);
      expect(validateSlug("a".repeat(81))).toBe(false);
    });

    it("matches exact DB CHECK regex", () => {
      expect(SLUG_REGEX.test("valid-slug-123")).toBe(true);
      expect(SLUG_REGEX.test("-invalid")).toBe(false);
      expect(SLUG_REGEX.test("invalid-")).toBe(false);
    });
  });

  describe("generateSlugSuggestions", () => {
    it("generates numbered suggestions on collision", () => {
      const suggestions = generateSlugSuggestions("aws-csa", 3);
      expect(suggestions).toEqual(["aws-csa-2", "aws-csa-3", "aws-csa-4"]);
    });

    it("ensures suggestions do not exceed 80 characters", () => {
      const longBase = "a".repeat(78);
      const suggestions = generateSlugSuggestions(longBase, 2);
      for (const s of suggestions) {
        expect(s.length).toBeLessThanOrEqual(80);
        expect(validateSlug(s)).toBe(true);
      }
    });
  });
});
