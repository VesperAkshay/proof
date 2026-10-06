import { pgTable, uuid, text, timestamp, jsonb, check, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { proofs } from "./proofs";

export const issuers = pgTable(
  "issuers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    websiteUrl: text("website_url"),
    domain: text("domain"),
    verificationMethod: text("verification_method"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    check("issuers_status_check", sql`${table.status} IN ('active', 'pending_review', 'blocked')`),
    index("issuers_domain_idx").on(table.domain),
  ]
);

export const verificationRecords = pgTable(
  "verification_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    proofId: uuid("proof_id")
      .notNull()
      .references(() => proofs.id, { onDelete: "cascade" }),
    method: text("method").notNull(),
    status: text("status").notNull().default("PENDING"),
    externalUrl: text("external_url"),
    evidence: jsonb("evidence"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true, mode: "date" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "verification_records_method_check",
      sql`${table.method} IN ('issuer_url', 'issuer_api', 'email_domain', 'manual_admin')`
    ),
    check(
      "verification_records_status_check",
      sql`${table.status} IN ('PENDING', 'CONFIRMED', 'FAILED', 'REVOKED')`
    ),
    check(
      "verification_records_actor_type_check",
      sql`${table.actorType} IN ('system', 'admin', 'issuer')`
    ),
    index("verification_records_proof_id_idx").on(table.proofId),
  ]
);

export const verificationEvents = pgTable(
  "verification_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    proofId: uuid("proof_id")
      .notNull()
      .references(() => proofs.id, { onDelete: "cascade" }),
    fromStatus: text("from_status").notNull(),
    toStatus: text("to_status").notNull(),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "verification_events_actor_type_check",
      sql`${table.actorType} IN ('system', 'admin', 'issuer')`
    ),
    index("verification_events_proof_id_idx").on(table.proofId),
  ]
);

export type Issuer = typeof issuers.$inferSelect;
export type NewIssuer = typeof issuers.$inferInsert;
export type VerificationRecord = typeof verificationRecords.$inferSelect;
export type NewVerificationRecord = typeof verificationRecords.$inferInsert;
export type VerificationEvent = typeof verificationEvents.$inferSelect;
export type NewVerificationEvent = typeof verificationEvents.$inferInsert;
