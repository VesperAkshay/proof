import { describe, it, expect } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  users,
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
  analyticsDaily,
  handleHistory,
} from "../schema";

describe("Database Constraints & Invariants (M1.3)", () => {
  describe("Primary & Composite Keys", () => {
    it("ensures proof_assets has composite primary key on (proofId, assetId)", () => {
      const config = getTableConfig(proofAssets);
      expect(config.primaryKeys.length).toBeGreaterThan(0);
      const pkColumnNames = config.primaryKeys[0]?.columns.map((c) => c.name);
      expect(pkColumnNames).toContain("proof_id");
      expect(pkColumnNames).toContain("asset_id");
    });

    it("ensures all core entities have primary keys", () => {
      expect(users.id.primary).toBe(true);
      expect(proofs.id.primary).toBe(true);
      expect(assets.id.primary).toBe(true);
      expect(uploadSessions.id.primary).toBe(true);
      expect(issuers.id.primary).toBe(true);
      expect(verificationRecords.id.primary).toBe(true);
      expect(verificationEvents.id.primary).toBe(true);
      expect(reports.id.primary).toBe(true);
      expect(auditLog.id.primary).toBe(true);
      expect(analyticsEvents.id.primary).toBe(true);
      expect(analyticsDaily.id.primary).toBe(true);
    });
  });

  describe("Unique Constraints & Anti-Collision Guarantees", () => {
    it("enforces username_normalized and auth_user_id uniqueness", () => {
      expect(users.usernameNormalized.isUnique).toBe(true);
      expect(users.authUserId.isUnique).toBe(true);
    });

    it("enforces asset object_key uniqueness", () => {
      expect(assets.objectKey.isUnique).toBe(true);
    });

    it("enforces composite uniqueness on (user_id, slug) in proofs and slug history", () => {
      const proofsConfig = getTableConfig(proofs);
      const slugHistoryConfig = getTableConfig(proofSlugHistory);

      const proofsUnique = proofsConfig.uniqueConstraints.find((u) =>
        u.name === "proofs_user_id_slug_unique"
      );
      expect(proofsUnique).toBeDefined();

      const historyUnique = slugHistoryConfig.uniqueConstraints.find((u) =>
        u.name === "proof_slug_history_user_id_slug_unique"
      );
      expect(historyUnique).toBeDefined();
    });
  });

  describe("Check Constraints & Domain Validation", () => {
    it("defines check constraints on users", () => {
      const config = getTableConfig(users);
      const checkNames = config.checks.map((c) => c.name);
      expect(checkNames).toContain("users_username_normalized_lowercase_check");
      expect(checkNames).toContain("users_username_normalized_format_check");
      expect(checkNames).toContain("users_status_enum_check");
    });

    it("defines check constraints on proofs", () => {
      const config = getTableConfig(proofs);
      const checkNames = config.checks.map((c) => c.name);
      expect(checkNames).toContain("proofs_slug_format_check");
      expect(checkNames).toContain("proofs_expires_after_issued_check");
      expect(checkNames).toContain("proofs_proof_type_check");
      expect(checkNames).toContain("proofs_lifecycle_state_check");
      expect(checkNames).toContain("proofs_visibility_check");
      expect(checkNames).toContain("proofs_verification_status_check");
    });

    it("defines check constraints on assets and upload sessions", () => {
      const assetConfig = getTableConfig(assets);
      expect(assetConfig.checks.map((c) => c.name)).toContain("assets_size_bytes_positive_check");
      expect(assetConfig.checks.map((c) => c.name)).toContain("assets_status_check");

      const sessionConfig = getTableConfig(uploadSessions);
      expect(sessionConfig.checks.map((c) => c.name)).toContain("upload_sessions_expected_size_positive_check");
      expect(sessionConfig.checks.map((c) => c.name)).toContain("upload_sessions_status_check");
    });
  });

  describe("Indexes & Performance Architecture", () => {
    it("defines required indexes across entities", () => {
      const handleHistoryIndexes = getTableConfig(handleHistory).indexes.map(
        (i) => i.config.name
      );
      expect(handleHistoryIndexes).toContain("handle_history_handle_normalized_idx");

      const proofsIndexes = getTableConfig(proofs).indexes.map(
        (i) => i.config.name
      );
      expect(proofsIndexes).toContain("proofs_user_sort_order_published_idx");

      const assetsIndexes = getTableConfig(assets).indexes.map(
        (i) => i.config.name
      );
      expect(assetsIndexes).toContain("assets_owner_id_status_idx");

      const analyticsIndexes = getTableConfig(analyticsEvents).indexes.map(
        (i) => i.config.name
      );
      expect(analyticsIndexes).toContain("analytics_events_proof_occurred_idx");
    });
  });

  describe("Foreign Key Cascade Rules", () => {
    it("configures cascade deletes from user to owned child records", () => {
      const handleFks = getTableConfig(handleHistory).foreignKeys;
      expect(handleFks[0]?.onDelete).toBe("cascade");

      const proofsFks = getTableConfig(proofs).foreignKeys;
      expect(proofsFks[0]?.onDelete).toBe("cascade");

      const assetsFks = getTableConfig(assets).foreignKeys;
      expect(assetsFks[0]?.onDelete).toBe("cascade");
    });
  });
});
