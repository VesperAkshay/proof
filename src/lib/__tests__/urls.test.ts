import { describe, it, expect } from "vitest";
import { sanitizeHttpsUrl, extractSafeHttpsLinks, EXTERNAL_LINK_PROPS } from "../urls";

describe("urls utility", () => {
  describe("sanitizeHttpsUrl", () => {
    it("accepts valid https URLs", () => {
      expect(sanitizeHttpsUrl("https://github.com/akshay")).toBe("https://github.com/akshay");
      expect(sanitizeHttpsUrl("https://proof.so/@alice/cred-1")).toBe("https://proof.so/@alice/cred-1");
    });

    it("rejects non-https protocols", () => {
      expect(sanitizeHttpsUrl("http://insecure.com")).toBeNull();
      expect(sanitizeHttpsUrl("javascript:alert(1)")).toBeNull();
      expect(sanitizeHttpsUrl("data:text/html,test")).toBeNull();
      expect(sanitizeHttpsUrl("ftp://files.example.com")).toBeNull();
      expect(sanitizeHttpsUrl("file:///etc/passwd")).toBeNull();
    });

    it("rejects malformed URLs and empty strings", () => {
      expect(sanitizeHttpsUrl("")).toBeNull();
      expect(sanitizeHttpsUrl("   ")).toBeNull();
      expect(sanitizeHttpsUrl("not a url")).toBeNull();
      expect(sanitizeHttpsUrl(null)).toBeNull();
      expect(sanitizeHttpsUrl(undefined)).toBeNull();
    });
  });

  describe("extractSafeHttpsLinks", () => {
    it("extracts unique https URLs from text", () => {
      const text = "Check out https://github.com/akshay and https://twitter.com/akshay.";
      const links = extractSafeHttpsLinks(text);
      expect(links).toEqual(["https://github.com/akshay", "https://twitter.com/akshay"]);
    });

    it("ignores http and javascript links in text", () => {
      const text = "Visit http://insecure.site and javascript:evil() or https://secure.org!";
      const links = extractSafeHttpsLinks(text);
      expect(links).toEqual(["https://secure.org/"]);
    });

    it("deduplicates identical URLs", () => {
      const text = "https://example.com/one and https://example.com/one";
      const links = extractSafeHttpsLinks(text);
      expect(links).toEqual(["https://example.com/one"]);
    });

    it("handles null and empty input gracefully", () => {
      expect(extractSafeHttpsLinks("")).toEqual([]);
      expect(extractSafeHttpsLinks(null)).toEqual([]);
      expect(extractSafeHttpsLinks(undefined)).toEqual([]);
    });
  });

  describe("EXTERNAL_LINK_PROPS", () => {
    it("provides correct security attributes", () => {
      expect(EXTERNAL_LINK_PROPS.target).toBe("_blank");
      expect(EXTERNAL_LINK_PROPS.rel).toBe("noopener noreferrer nofollow ugc");
    });
  });
});
