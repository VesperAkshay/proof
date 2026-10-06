import { pgTable, uuid, text, timestamp, integer, check, unique, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";

export const proofs = pgTable(
  "proofs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    proofType: text("proof_type").notNull(),
    issuerId: uuid("issuer_id"),
    issuerNameText: text("issuer_name_text"),
    issuedAt: timestamp("issued_at", { withTimezone: true, mode: "date" }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    credentialId: text("credential_id"),
    credentialUrl: text("credential_url"),
    lifecycleState: text("lifecycle_state").notNull().default("DRAFT"),
    visibility: text("visibility").notNull().default("private"),
    verificationStatus: text("verification_status").notNull().default("SELF_REPORTED"),
    sortOrder: integer("sort_order").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    unique("proofs_user_id_slug_unique").on(table.userId, table.slug),
    check(
      "proofs_slug_format_check",
      sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(${table.slug}) BETWEEN 1 AND 80`
    ),
    check(
      "proofs_expires_after_issued_check",
      sql`${table.expiresAt} IS NULL OR ${table.issuedAt} IS NULL OR ${table.expiresAt} > ${table.issuedAt}`
    ),
    check(
      "proofs_proof_type_check",
      sql`${table.proofType} IN ('certificate','award','achievement','course_completion','hackathon','internship','license','project','publication','workshop','custom')`
    ),
    check(
      "proofs_lifecycle_state_check",
      sql`${table.lifecycleState} IN ('DRAFT','PUBLISHED','ARCHIVED')`
    ),
    check(
      "proofs_visibility_check",
      sql`${table.visibility} IN ('private','unlisted','public')`
    ),
    check(
      "proofs_verification_status_check",
      sql`${table.verificationStatus} IN ('SELF_REPORTED','DOCUMENT_UPLOADED','ISSUER_REFERENCED','ISSUER_VERIFIED','REVOKED')`
    ),
    index("proofs_user_sort_order_published_idx")
      .on(table.userId, table.sortOrder)
      .where(sql`${table.lifecycleState} = 'PUBLISHED'`),
  ]
);

export const proofSlugHistory = pgTable(
  "proof_slug_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    proofId: uuid("proof_id")
      .notNull()
      .references(() => proofs.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    unique("proof_slug_history_user_id_slug_unique").on(table.userId, table.slug),
    index("proof_slug_history_slug_idx").on(table.slug),
  ]
);

export type Proof = typeof proofs.$inferSelect;
export type NewProof = typeof proofs.$inferInsert;
export type ProofSlugHistory = typeof proofSlugHistory.$inferSelect;
export type NewProofSlugHistory = typeof proofSlugHistory.$inferInsert;
