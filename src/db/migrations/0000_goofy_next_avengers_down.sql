-- Down migration for 0000_goofy_next_avengers.sql
-- Reverses all table, index, foreign key, and constraint creations in reverse dependency order

DROP TABLE IF EXISTS "analytics_events" CASCADE;
DROP TABLE IF EXISTS "reports" CASCADE;
DROP TABLE IF EXISTS "audit_log" CASCADE;
DROP TABLE IF EXISTS "verification_records" CASCADE;
DROP TABLE IF EXISTS "verification_events" CASCADE;
DROP TABLE IF EXISTS "issuers" CASCADE;
DROP TABLE IF EXISTS "upload_sessions" CASCADE;
DROP TABLE IF EXISTS "proof_assets" CASCADE;
DROP TABLE IF EXISTS "assets" CASCADE;
DROP TABLE IF EXISTS "proof_slug_history" CASCADE;
DROP TABLE IF EXISTS "proofs" CASCADE;
DROP TABLE IF EXISTS "handle_history" CASCADE;
DROP TABLE IF EXISTS "reserved_handles" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;
