import { pgTable, uuid, text, timestamp, jsonb, check, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reporterUserId: uuid("reporter_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    reason: text("reason").notNull(),
    details: text("details"),
    status: text("status").notNull().default("OPEN"),
    handledBy: text("handled_by"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    check("reports_target_type_check", sql`${table.targetType} IN ('proof', 'profile')`),
    check("reports_status_check", sql`${table.status} IN ('OPEN', 'ACTIONED', 'DISMISSED')`),
    index("reports_target_idx").on(table.targetType, table.targetId),
    index("reports_status_idx").on(table.status),
  ]
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    action: text("action").notNull(),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("audit_log_target_idx").on(table.targetType, table.targetId),
    index("audit_log_created_at_idx").on(table.createdAt),
  ]
);

export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;
