import { describe, it, expect } from "vitest";
import {
  normalizeHandle,
  validateHandle,
  generateHandleSuggestions,
} from "../handle";

describe("Handle Normalization & Validation (M2.3, M2.13)", () => {
  describe("normalizeHandle", () => {
    it("strips leading '@' prefix", () => {
      expect(normalizeHandle("@akshay")).toBe("akshay");
      expect(normalizeHandle("@@akshay")).toBe("@akshay"); // only single leading @ stripped
    });

    it("trims surrounding whitespace", () => {
      expect(normalizeHandle("  akshay  ")).toBe("akshay");
      expect(normalizeHandle("\t@akshay\n")).toBe("akshay");
    });

    it("converts all casing to lowercase", () => {
      expect(normalizeHandle("Akshay")).toBe("akshay");
      expect(normalizeHandle("@AKSHAY-DEV")).toBe("akshay-dev");
    });

    it("handles empty or falsy inputs gracefully", () => {
      expect(normalizeHandle("")).toBe("");
    });
  });

  describe("validateHandle", () => {
    it("accepts valid canonical handles", () => {
      const valid = ["akshay", "akshay-patel", "dev_123", "abc", "john-doe-99"];
      valid.forEach((h) => {
        const res = validateHandle(h);
        expect(res.isValid).toBe(true);
        expect(res.normalized).toBe(h);
      });
    });

    it("rejects handles shorter than 3 characters", () => {
      expect(validateHandle("a").isValid).toBe(false);
      expect(validateHandle("a").reason).toBe("TOO_SHORT");
      expect(validateHandle("ab").isValid).toBe(false);
      expect(validateHandle("ab").reason).toBe("TOO_SHORT");
    });

    it("rejects handles longer than 30 characters", () => {
      const tooLong = "a".repeat(31);
      expect(validateHandle(tooLong).isValid).toBe(false);
      expect(validateHandle(tooLong).reason).toBe("TOO_LONG");
    });

    it("rejects handles starting or ending with hyphens or underscores", () => {
      expect(validateHandle("-akshay").reason).toBe("START_OR_END_SEPARATOR");
      expect(validateHandle("akshay-").reason).toBe("START_OR_END_SEPARATOR");
      expect(validateHandle("_akshay").reason).toBe("START_OR_END_SEPARATOR");
      expect(validateHandle("akshay_").reason).toBe("START_OR_END_SEPARATOR");
    });

    it("rejects non-ASCII and homoglyph attack characters (M2.13)", () => {
      // Cyrillic 'а' looks like Latin 'a' but is \u0430
      const cyrillicA = "aksh\u0430y";
      expect(validateHandle(cyrillicA).isValid).toBe(false);
      expect(validateHandle(cyrillicA).reason).toBe("INVALID_CHARACTERS");

      // Special symbols
      expect(validateHandle("akshay!").isValid).toBe(false);
      expect(validateHandle("akshay.dev").isValid).toBe(false);
      expect(validateHandle("akshay dev").isValid).toBe(false);
    });
  });

  describe("generateHandleSuggestions (M2.6)", () => {
    it("generates 3 valid available suggestions", async () => {
      const taken = new Set(["akshaydev", "akshay-proof"]);
      const isAvailable = (candidate: string) => !taken.has(candidate);

      const suggestions = await generateHandleSuggestions("akshay", isAvailable);
      expect(suggestions.length).toBe(3);
      expect(suggestions).not.toContain("akshaydev");
      expect(suggestions).not.toContain("akshay-proof");
      suggestions.forEach((s) => {
        expect(validateHandle(s).isValid).toBe(true);
      });
    });
  });
});
