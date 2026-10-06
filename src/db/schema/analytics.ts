import { pgTable, uuid, text, timestamp, check, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { proofs } from "./proofs";

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventType: text("event_type").notNull(),
    proofId: uuid("proof_id").references(() => proofs.id, { onDelete: "cascade" }),
    profileUserId: uuid("profile_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    referrerHost: text("referrer_host"),
    deviceClass: text("device_class"),
    countryCode: text("country_code"),
    visitorHash: text("visitor_hash"),
  },
  (table) => [
    check(
      "analytics_events_type_check",
      sql`${table.eventType} IN ('profile_view', 'proof_view', 'download', 'qr_scan', 'external_link_click')`
    ),
    index("analytics_events_proof_occurred_idx").on(table.proofId, table.occurredAt),
    index("analytics_events_profile_occurred_idx").on(table.profileUserId, table.occurredAt),
  ]
);

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type NewAnalyticsEvent = typeof analyticsEvents.$inferInsert;
