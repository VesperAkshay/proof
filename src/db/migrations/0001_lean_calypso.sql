CREATE TABLE "analytics_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"profile_user_id" uuid NOT NULL,
	"proof_id" uuid,
	"event_type" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"unique_visitors" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "analytics_daily_type_check" CHECK ("analytics_daily"."event_type" IN ('profile_view', 'proof_view', 'download', 'qr_scan', 'external_link_click'))
);
--> statement-breakpoint
ALTER TABLE "analytics_daily" ADD CONSTRAINT "analytics_daily_profile_user_id_users_id_fk" FOREIGN KEY ("profile_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_daily" ADD CONSTRAINT "analytics_daily_proof_id_proofs_id_fk" FOREIGN KEY ("proof_id") REFERENCES "public"."proofs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_daily_unique_record_idx" ON "analytics_daily" USING btree ("date","profile_user_id",COALESCE("proof_id", '00000000-0000-0000-0000-000000000000'::uuid),"event_type");--> statement-breakpoint
CREATE INDEX "analytics_daily_profile_date_idx" ON "analytics_daily" USING btree ("profile_user_id","date");--> statement-breakpoint
CREATE INDEX "analytics_daily_proof_date_idx" ON "analytics_daily" USING btree ("proof_id","date");