-- Down migration for 0001_lean_calypso.sql
-- Reverses creation of analytics_daily table, constraints, and indexes

DROP TABLE IF EXISTS "analytics_daily" CASCADE;
