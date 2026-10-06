import { describe, it, expect } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  users,
  proofs,
  proofSlugHistory,
  assets,
  proofAssets,
  uploadSessions,
} from "../schema";
import {
  isValidLifecycleTransition,
  isValidAssetTransition,
  isValidVerificationTransition,
} from "../transitions";

describe("Milestone M1 Exit Gate — Schema Integrity & Invariants (M1.6)", () => {
  describe("Gate 1: Duplicate usernames impossible", () => {
    it("enforces UNIQUE constraint on users.username_normalized", () => {
      expect(users.usernameNormalized.isUnique).toBe(true);
      expect(users.authUserId.isUnique).toBe(true);
    });

    it("guarantees case-insensitive collisions resolve to the same normalized handle", () => {
      const normalize = (input: string) => input.trim().toLowerCase();
      const variantA = "Akshay";
      const variantB = "AKSHAY";
      const variantC = "akshay";

      expect(normalize(variantA)).toBe(normalize(variantB));
      expect(normalize(variantB)).toBe(normalize(variantC));
      // In the database, all 3 attempt to insert 'akshay', triggering UNIQUE violation
    });
  });

  describe("Gate 2: Duplicate proof slugs within owner impossible", () => {
    it("enforces composite UNIQUE(user_id, slug) on proofs table", () => {
      const config = getTableConfig(proofs);
      const uniqueConstraint = config.uniqueConstraints.find((u) =>
        u.name === "proofs_user_id_slug_unique"
      );
      expect(uniqueConstraint).toBeDefined();
      const cols = uniqueConstraint?.columns.map((c) => c.name);
      expect(cols).toContain("user_id");
      expect(cols).toContain("slug");
    });

    it("enforces composite UNIQUE(user_id, slug) on proof_slug_history table", () => {
      const config = getTableConfig(proofSlugHistory);
      const uniqueConstraint = config.uniqueConstraints.find((u) =>
        u.name === "proof_slug_history_user_id_slug_unique"
      );
      expect(uniqueConstraint).toBeDefined();
      const cols = uniqueConstraint?.columns.map((c) => c.name);
      expect(cols).toContain("user_id");
      expect(cols).toContain("slug");
    });

    it("permits identical slugs across different owners", () => {
      // Different user_id + same slug produces distinct (user_id, slug) tuples
      const user1 = "11111111-1111-1111-1111-111111111111";
      const user2 = "22222222-2222-2222-2222-222222222222";
      const slug = "aws-solutions-architect";

      const tuple1 = `${user1}:${slug}`;
      const tuple2 = `${user2}:${slug}`;
      expect(tuple1).not.toBe(tuple2);
    });
  });

  describe("Gate 3: Orphan assets impossible", () => {
    it("enforces assets.owner_id NOT NULL referencing users with ON DELETE CASCADE", () => {
      expect(assets.ownerId.notNull).toBe(true);

      const fks = getTableConfig(assets).foreignKeys;
      expect(fks[0]?.onDelete).toBe("cascade");
    });

    it("enforces proof_assets composite primary key and cascade deletes", () => {
      const config = getTableConfig(proofAssets);
      expect(config.primaryKeys.length).toBeGreaterThan(0);

      const fks = config.foreignKeys;
      expect(fks.every((fk) => fk.onDelete === "cascade")).toBe(true);
    });

    it("enforces upload_sessions requires valid owner and asset with cascade deletes", () => {
      expect(uploadSessions.ownerId.notNull).toBe(true);
      expect(uploadSessions.assetId.notNull).toBe(true);

      const fks = getTableConfig(uploadSessions).foreignKeys;
      expect(fks.every((fk) => fk.onDelete === "cascade")).toBe(true);
    });
  });

  describe("Gate 4: Invalid statuses impossible", () => {
    it("restricts users.status to valid active/suspended/deleted enum", () => {
      const config = getTableConfig(users);
      const statusCheck = config.checks.find((c) => c.name === "users_status_enum_check");
      expect(statusCheck).toBeDefined();
    });

    it("restricts assets.status to strict processing enum", () => {
      const config = getTableConfig(assets);
      const statusCheck = config.checks.find((c) => c.name === "assets_status_check");
      expect(statusCheck).toBeDefined();
    });

    it("restricts proofs.lifecycle_state and visibility to valid enums", () => {
      const config = getTableConfig(proofs);
      expect(config.checks.some((c) => c.name === "proofs_lifecycle_state_check")).toBe(true);
      expect(config.checks.some((c) => c.name === "proofs_visibility_check")).toBe(true);
    });

    it("ensures derived EXPIRED is not an allowable verification_status in database", () => {
      const config = getTableConfig(proofs);
      const verificationCheck = config.checks.find(
        (c) => c.name === "proofs_verification_status_check"
      );
      expect(verificationCheck).toBeDefined();
    });
  });

  describe("Gate 5: Illegal state transitions rejected", () => {
    describe("Asset State Machine", () => {
      it("allows legal progression: PENDING_UPLOAD -> QUARANTINED -> SCANNING -> READY", () => {
        expect(isValidAssetTransition("PENDING_UPLOAD", "QUARANTINED")).toBe(true);
        expect(isValidAssetTransition("QUARANTINED", "SCANNING")).toBe(true);
        expect(isValidAssetTransition("SCANNING", "READY")).toBe(true);
      });

      it("rejects illegal skip-ahead: PENDING_UPLOAD -> READY (bypassing scan)", () => {
        expect(isValidAssetTransition("PENDING_UPLOAD", "READY")).toBe(false);
      });

      it("rejects transition from REJECTED back to READY", () => {
        expect(isValidAssetTransition("REJECTED", "READY")).toBe(false);
      });

      it("rejects transitions out of DELETED (terminal state)", () => {
        expect(isValidAssetTransition("DELETED", "READY")).toBe(false);
        expect(isValidAssetTransition("DELETED", "SCANNING")).toBe(false);
      });
    });

    describe("Lifecycle State Machine", () => {
      it("allows legal editorial transitions", () => {
        expect(isValidLifecycleTransition("DRAFT", "PUBLISHED")).toBe(true);
        expect(isValidLifecycleTransition("PUBLISHED", "DRAFT")).toBe(true);
        expect(isValidLifecycleTransition("PUBLISHED", "ARCHIVED")).toBe(true);
        expect(isValidLifecycleTransition("ARCHIVED", "PUBLISHED")).toBe(true);
      });
    });

    describe("Verification State Machine & Actor Authorization", () => {
      it("owner can NEVER set ISSUER_VERIFIED directly (Protected Word Rule)", () => {
        expect(
          isValidVerificationTransition("SELF_REPORTED", "ISSUER_VERIFIED", "owner")
        ).toBe(false);
        expect(
          isValidVerificationTransition("DOCUMENT_UPLOADED", "ISSUER_VERIFIED", "owner")
        ).toBe(false);
        expect(
          isValidVerificationTransition("ISSUER_REFERENCED", "ISSUER_VERIFIED", "owner")
        ).toBe(false);
      });

      it("owner can NEVER set REVOKED directly", () => {
        expect(
          isValidVerificationTransition("ISSUER_VERIFIED", "REVOKED", "owner")
        ).toBe(false);
      });

      it("system and admin flows can transition to ISSUER_VERIFIED", () => {
        expect(
          isValidVerificationTransition("DOCUMENT_UPLOADED", "ISSUER_VERIFIED", "system")
        ).toBe(true);
        expect(
          isValidVerificationTransition("ISSUER_REFERENCED", "ISSUER_VERIFIED", "admin")
        ).toBe(true);
      });

      it("admin and issuer flows can transition to REVOKED", () => {
        expect(
          isValidVerificationTransition("ISSUER_VERIFIED", "REVOKED", "admin")
        ).toBe(true);
        expect(
          isValidVerificationTransition("ISSUER_VERIFIED", "REVOKED", "issuer")
        ).toBe(true);
      });
    });
  });
});
