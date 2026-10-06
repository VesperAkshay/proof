import { describe, it, expect } from "vitest";
import { CANONICAL_RESERVED_HANDLES, CANONICAL_ISSUERS } from "../seed";

describe("Seed Data Invariants & Reserved Handles (M1.4)", () => {
  describe("Reserved Handles", () => {
    it("contains critical system and application routing keywords", () => {
      const handles = CANONICAL_RESERVED_HANDLES.map((r) => r.handleNormalized);
      const essentialRoutes = [
        "api",
        "login",
        "logout",
        "signup",
        "auth",
        "admin",
        "dashboard",
        "me",
        "u",
        "proof",
        "proofs",
        "verify",
        "settings",
        "root",
        "null",
        "undefined",
        "assets",
        "uploads",
        "status",
        "healthz",
      ];

      essentialRoutes.forEach((route) => {
        expect(handles).toContain(route);
      });
    });

    it("ensures all reserved handles are unique (no duplicates in seed set)", () => {
      const handles = CANONICAL_RESERVED_HANDLES.map((r) => r.handleNormalized);
      const uniqueHandles = new Set(handles);
      expect(uniqueHandles.size).toBe(handles.length);
    });

    it("ensures all reserved handles are strictly lowercase and trimmed", () => {
      CANONICAL_RESERVED_HANDLES.forEach(({ handleNormalized }) => {
        expect(handleNormalized).toBe(handleNormalized.toLowerCase());
        expect(handleNormalized).toBe(handleNormalized.trim());
      });
    });

    it("ensures all reserved handles include non-empty documented reasons", () => {
      CANONICAL_RESERVED_HANDLES.forEach(({ reason }) => {
        expect(reason).toBeTruthy();
        expect(reason.length).toBeGreaterThan(3);
      });
    });
  });

  describe("Canonical Issuers", () => {
    it("seeds verified issuers with valid domain and https URLs", () => {
      expect(CANONICAL_ISSUERS.length).toBeGreaterThan(0);
      CANONICAL_ISSUERS.forEach((issuer) => {
        expect(issuer.name).toBeTruthy();
        expect(issuer.domain).toMatch(/^[a-z0-9.-]+\.[a-z]{2,}$/);
        expect(issuer.websiteUrl).toMatch(/^https:\/\//);
        expect(issuer.status).toBe("active");
        expect(issuer.verificationMethod).toBe("issuer_url");
      });
    });
  });
});
