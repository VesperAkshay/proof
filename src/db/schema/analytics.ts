import {
  pgTable,
  uuid,
  text,
  timestamp,
  check,
  index,
  date,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";
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

export const analyticsDaily = pgTable(
  "analytics_daily",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    date: date("date").notNull(),
    profileUserId: uuid("profile_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    proofId: uuid("proof_id").references(() => proofs.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    count: integer("count").notNull().default(0),
    uniqueVisitors: integer("unique_visitors").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "analytics_daily_type_check",
      sql`${table.eventType} IN ('profile_view', 'proof_view', 'download', 'qr_scan', 'external_link_click')`
    ),
    uniqueIndex("analytics_daily_unique_record_idx").on(
      table.date,
      table.profileUserId,
      sql`COALESCE(${table.proofId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      table.eventType
    ),
    index("analytics_daily_profile_date_idx").on(table.profileUserId, table.date),
    index("analytics_daily_proof_date_idx").on(table.proofId, table.date),
  ]
);

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type NewAnalyticsEvent = typeof analyticsEvents.$inferInsert;
export type AnalyticsDaily = typeof analyticsDaily.$inferSelect;
export type NewAnalyticsDaily = typeof analyticsDaily.$inferInsert;
