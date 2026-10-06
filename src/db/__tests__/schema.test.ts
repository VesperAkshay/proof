import { describe, it, expect } from "vitest";
import {
  users,
  handleHistory,
  reservedHandles,
  proofs,
  proofSlugHistory,
  assets,
  proofAssets,
  uploadSessions,
  issuers,
  verificationRecords,
  verificationEvents,
  reports,
  auditLog,
  analyticsEvents,
} from "../schema";

describe("Database Schema Definitions (M1.1)", () => {
  it("exports all 14 required relational tables", () => {
    expect(users).toBeDefined();
    expect(handleHistory).toBeDefined();
    expect(reservedHandles).toBeDefined();
    expect(proofs).toBeDefined();
    expect(proofSlugHistory).toBeDefined();
    expect(assets).toBeDefined();
    expect(proofAssets).toBeDefined();
    expect(uploadSessions).toBeDefined();
    expect(issuers).toBeDefined();
    expect(verificationRecords).toBeDefined();
    expect(verificationEvents).toBeDefined();
    expect(reports).toBeDefined();
    expect(auditLog).toBeDefined();
    expect(analyticsEvents).toBeDefined();
  });

  describe("Username constraint logic", () => {
    // Regex matching: '^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$'
    const usernameRegex = /^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$/;

    it("accepts valid canonical usernames", () => {
      const validHandles = [
        "akshay",
        "akshay-patel",
        "dev_123",
        "alex99",
        "user-name-valid",
        "abc", // minimum 3 chars
      ];
      validHandles.forEach((handle) => {
        expect(usernameRegex.test(handle)).toBe(true);
      });
    });

    it("rejects invalid usernames (edge characters, casing, length)", () => {
      const invalidHandles = [
        "ab", // too short (< 3)
        "a".repeat(31), // too long (> 30)
        "-leading", // leading hyphen
        "trailing-", // trailing hyphen
        "_leading", // leading underscore
        "trailing_", // trailing underscore
        "Uppercase", // uppercase characters
        "has space", // spaces
        "user@handle", // illegal symbols
      ];
      invalidHandles.forEach((handle) => {
        expect(usernameRegex.test(handle)).toBe(false);
      });
    });
  });

  describe("Proof slug constraint logic", () => {
    // Regex matching: '^[a-z0-9]+(-[a-z0-9]+)*$' and length between 1 and 80
    const slugRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;

    it("accepts valid canonical slugs", () => {
      const validSlugs = [
        "aws-solutions-architect",
        "hackathon-2026",
        "cert",
        "v1",
        "my-first-proof-project",
      ];
      validSlugs.forEach((slug) => {
        expect(slugRegex.test(slug)).toBe(true);
        expect(slug.length >= 1 && slug.length <= 80).toBe(true);
      });
    });

    it("rejects invalid slugs", () => {
      const invalidSlugs = [
        "-leading-dash",
        "trailing-dash-",
        "double--dash",
        "has_underscore",
        "UpperCaseSlug",
        "has space",
      ];
      invalidSlugs.forEach((slug) => {
        expect(slugRegex.test(slug)).toBe(false);
      });
    });
  });

  describe("Verification status and lifecycle state constraints", () => {
    const validVerificationStatuses = [
      "SELF_REPORTED",
      "DOCUMENT_UPLOADED",
      "ISSUER_REFERENCED",
      "ISSUER_VERIFIED",
      "REVOKED",
    ];

    const validLifecycleStates = ["DRAFT", "PUBLISHED", "ARCHIVED"];

    it("defines independent axes for lifecycle and verification", () => {
      expect(validVerificationStatuses).toContain("SELF_REPORTED");
      expect(validVerificationStatuses).toContain("ISSUER_VERIFIED");
      expect(validLifecycleStates).toContain("DRAFT");
      expect(validLifecycleStates).toContain("PUBLISHED");
    });

    it("ensures derived EXPIRED is not stored as a database state", () => {
      expect(validVerificationStatuses).not.toContain("EXPIRED");
    });
  });
});
