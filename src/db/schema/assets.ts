import { pgTable, uuid, text, timestamp, bigint, integer, check, primaryKey, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { proofs } from "./proofs";

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    objectKey: text("object_key").notNull().unique(),
    originalFilename: text("original_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    detectedMimeType: text("detected_mime_type"),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    sha256: text("sha256"),
    status: text("status").notNull().default("PENDING_UPLOAD"),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    check("assets_size_bytes_positive_check", sql`${table.sizeBytes} > 0`),
    check(
      "assets_status_check",
      sql`${table.status} IN ('PENDING_UPLOAD','QUARANTINED','SCANNING','READY','REJECTED','DELETED')`
    ),
    index("assets_owner_id_status_idx").on(table.ownerId, table.status),
  ]
);

export const proofAssets = pgTable(
  "proof_assets",
  {
    proofId: uuid("proof_id")
      .notNull()
      .references(() => proofs.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("evidence"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.proofId, table.assetId] }),
    check("proof_assets_role_check", sql`${table.role} IN ('evidence','cover','preview')`),
    index("proof_assets_asset_id_idx").on(table.assetId),
  ]
);

export const uploadSessions = pgTable(
  "upload_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("PENDING"),
    expectedSize: bigint("expected_size", { mode: "number" }).notNull(),
    multipartUploadId: text("multipart_upload_id"),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    check("upload_sessions_expected_size_positive_check", sql`${table.expectedSize} > 0`),
    check(
      "upload_sessions_status_check",
      sql`${table.status} IN ('PENDING','COMPLETED','ABORTED','EXPIRED')`
    ),
    index("upload_sessions_owner_id_idx").on(table.ownerId),
  ]
);

export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
export type ProofAsset = typeof proofAssets.$inferSelect;
export type NewProofAsset = typeof proofAssets.$inferInsert;
export type UploadSession = typeof uploadSessions.$inferSelect;
export type NewUploadSession = typeof uploadSessions.$inferInsert;
