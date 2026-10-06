import { pgTable, uuid, text, timestamp, check, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    authUserId: text("auth_user_id").notNull().unique(),
    username: text("username").notNull(),
    usernameNormalized: text("username_normalized").notNull().unique(),
    displayName: text("display_name"),
    bio: text("bio"),
    avatarAssetId: uuid("avatar_asset_id"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "users_username_normalized_lowercase_check",
      sql`${table.usernameNormalized} = lower(${table.usernameNormalized})`
    ),
    check(
      "users_username_normalized_format_check",
      sql`${table.usernameNormalized} ~ '^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$'`
    ),
    check(
      "users_status_enum_check",
      sql`${table.status} IN ('active', 'suspended', 'deleted')`
    ),
  ]
);

export const handleHistory = pgTable(
  "handle_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    handleNormalized: text("handle_normalized").notNull(),
    releasedAt: timestamp("released_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("handle_history_handle_normalized_idx").on(table.handleNormalized),
    index("handle_history_user_id_idx").on(table.userId),
  ]
);

export const reservedHandles = pgTable("reserved_handles", {
  handleNormalized: text("handle_normalized").primaryKey(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type HandleHistory = typeof handleHistory.$inferSelect;
export type NewHandleHistory = typeof handleHistory.$inferInsert;
export type ReservedHandle = typeof reservedHandles.$inferSelect;
