CREATE TABLE "handle_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"handle_normalized" text NOT NULL,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reserved_handles" (
	"handle_normalized" text PRIMARY KEY NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" text NOT NULL,
	"username" text NOT NULL,
	"username_normalized" text NOT NULL,
	"display_name" text,
	"bio" text,
	"avatar_asset_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_auth_user_id_unique" UNIQUE("auth_user_id"),
	CONSTRAINT "users_username_normalized_unique" UNIQUE("username_normalized"),
	CONSTRAINT "users_username_normalized_lowercase_check" CHECK ("users"."username_normalized" = lower("users"."username_normalized")),
	CONSTRAINT "users_username_normalized_format_check" CHECK ("users"."username_normalized" ~ '^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$'),
	CONSTRAINT "users_status_enum_check" CHECK ("users"."status" IN ('active', 'suspended', 'deleted'))
);
--> statement-breakpoint
CREATE TABLE "proof_slug_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proof_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proof_slug_history_user_id_slug_unique" UNIQUE("user_id","slug")
);
--> statement-breakpoint
CREATE TABLE "proofs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"proof_type" text NOT NULL,
	"issuer_id" uuid,
	"issuer_name_text" text,
	"issued_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"credential_id" text,
	"credential_url" text,
	"lifecycle_state" text DEFAULT 'DRAFT' NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"verification_status" text DEFAULT 'SELF_REPORTED' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proofs_user_id_slug_unique" UNIQUE("user_id","slug"),
	CONSTRAINT "proofs_slug_format_check" CHECK ("proofs"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length("proofs"."slug") BETWEEN 1 AND 80),
	CONSTRAINT "proofs_expires_after_issued_check" CHECK ("proofs"."expires_at" IS NULL OR "proofs"."issued_at" IS NULL OR "proofs"."expires_at" > "proofs"."issued_at"),
	CONSTRAINT "proofs_proof_type_check" CHECK ("proofs"."proof_type" IN ('certificate','award','achievement','course_completion','hackathon','internship','license','project','publication','workshop','custom')),
	CONSTRAINT "proofs_lifecycle_state_check" CHECK ("proofs"."lifecycle_state" IN ('DRAFT','PUBLISHED','ARCHIVED')),
	CONSTRAINT "proofs_visibility_check" CHECK ("proofs"."visibility" IN ('private','unlisted','public')),
	CONSTRAINT "proofs_verification_status_check" CHECK ("proofs"."verification_status" IN ('SELF_REPORTED','DOCUMENT_UPLOADED','ISSUER_REFERENCED','ISSUER_VERIFIED','REVOKED'))
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"original_filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"detected_mime_type" text,
	"size_bytes" bigint NOT NULL,
	"sha256" text,
	"status" text DEFAULT 'PENDING_UPLOAD' NOT NULL,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "assets_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "assets_size_bytes_positive_check" CHECK ("assets"."size_bytes" > 0),
	CONSTRAINT "assets_status_check" CHECK ("assets"."status" IN ('PENDING_UPLOAD','QUARANTINED','SCANNING','READY','REJECTED','DELETED'))
);
--> statement-breakpoint
CREATE TABLE "proof_assets" (
	"proof_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"role" text DEFAULT 'evidence' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "proof_assets_proof_id_asset_id_pk" PRIMARY KEY("proof_id","asset_id"),
	CONSTRAINT "proof_assets_role_check" CHECK ("proof_assets"."role" IN ('evidence','cover','preview'))
);
--> statement-breakpoint
CREATE TABLE "upload_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"expected_size" bigint NOT NULL,
	"multipart_upload_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "upload_sessions_expected_size_positive_check" CHECK ("upload_sessions"."expected_size" > 0),
	CONSTRAINT "upload_sessions_status_check" CHECK ("upload_sessions"."status" IN ('PENDING','COMPLETED','ABORTED','EXPIRED'))
);
--> statement-breakpoint
CREATE TABLE "issuers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"website_url" text,
	"domain" text,
	"verification_method" text,
	"created_by" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issuers_status_check" CHECK ("issuers"."status" IN ('active', 'pending_review', 'blocked'))
);
--> statement-breakpoint
CREATE TABLE "verification_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proof_id" uuid NOT NULL,
	"from_status" text NOT NULL,
	"to_status" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "verification_events_actor_type_check" CHECK ("verification_events"."actor_type" IN ('system', 'admin', 'issuer'))
);
--> statement-breakpoint
CREATE TABLE "verification_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proof_id" uuid NOT NULL,
	"method" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"external_url" text,
	"evidence" jsonb,
	"confirmed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"actor_type" text NOT NULL,
	"actor_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "verification_records_method_check" CHECK ("verification_records"."method" IN ('issuer_url', 'issuer_api', 'email_domain', 'manual_admin')),
	CONSTRAINT "verification_records_status_check" CHECK ("verification_records"."status" IN ('PENDING', 'CONFIRMED', 'FAILED', 'REVOKED')),
	CONSTRAINT "verification_records_actor_type_check" CHECK ("verification_records"."actor_type" IN ('system', 'admin', 'issuer'))
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_user_id" uuid,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"details" text,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"handled_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_target_type_check" CHECK ("reports"."target_type" IN ('proof', 'profile')),
	CONSTRAINT "reports_status_check" CHECK ("reports"."status" IN ('OPEN', 'ACTIONED', 'DISMISSED'))
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"proof_id" uuid,
	"profile_user_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"referrer_host" text,
	"device_class" text,
	"country_code" text,
	"visitor_hash" text,
	CONSTRAINT "analytics_events_type_check" CHECK ("analytics_events"."event_type" IN ('profile_view', 'proof_view', 'download', 'qr_scan', 'external_link_click'))
);
--> statement-breakpoint
ALTER TABLE "handle_history" ADD CONSTRAINT "handle_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proof_slug_history" ADD CONSTRAINT "proof_slug_history_proof_id_proofs_id_fk" FOREIGN KEY ("proof_id") REFERENCES "public"."proofs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proof_slug_history" ADD CONSTRAINT "proof_slug_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proofs" ADD CONSTRAINT "proofs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proof_assets" ADD CONSTRAINT "proof_assets_proof_id_proofs_id_fk" FOREIGN KEY ("proof_id") REFERENCES "public"."proofs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proof_assets" ADD CONSTRAINT "proof_assets_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issuers" ADD CONSTRAINT "issuers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_events" ADD CONSTRAINT "verification_events_proof_id_proofs_id_fk" FOREIGN KEY ("proof_id") REFERENCES "public"."proofs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_records" ADD CONSTRAINT "verification_records_proof_id_proofs_id_fk" FOREIGN KEY ("proof_id") REFERENCES "public"."proofs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_proof_id_proofs_id_fk" FOREIGN KEY ("proof_id") REFERENCES "public"."proofs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_profile_user_id_users_id_fk" FOREIGN KEY ("profile_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "handle_history_handle_normalized_idx" ON "handle_history" USING btree ("handle_normalized");--> statement-breakpoint
CREATE INDEX "handle_history_user_id_idx" ON "handle_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "proof_slug_history_slug_idx" ON "proof_slug_history" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "proofs_user_sort_order_published_idx" ON "proofs" USING btree ("user_id","sort_order") WHERE "proofs"."lifecycle_state" = 'PUBLISHED';--> statement-breakpoint
CREATE INDEX "assets_owner_id_status_idx" ON "assets" USING btree ("owner_id","status");--> statement-breakpoint
CREATE INDEX "proof_assets_asset_id_idx" ON "proof_assets" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "upload_sessions_owner_id_idx" ON "upload_sessions" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "issuers_domain_idx" ON "issuers" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "verification_events_proof_id_idx" ON "verification_events" USING btree ("proof_id");--> statement-breakpoint
CREATE INDEX "verification_records_proof_id_idx" ON "verification_records" USING btree ("proof_id");--> statement-breakpoint
CREATE INDEX "audit_log_target_idx" ON "audit_log" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "reports_target_idx" ON "reports" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "analytics_events_proof_occurred_idx" ON "analytics_events" USING btree ("proof_id","occurred_at");--> statement-breakpoint
CREATE INDEX "analytics_events_profile_occurred_idx" ON "analytics_events" USING btree ("profile_user_id","occurred_at");