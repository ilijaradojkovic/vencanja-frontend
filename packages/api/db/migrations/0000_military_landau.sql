CREATE TYPE "public"."email_status" AS ENUM('sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('wedding', 'celebration');--> statement-breakpoint
CREATE TYPE "public"."guest_side" AS ENUM('mlada', 'mladozenja', 'zajednicki');--> statement-breakpoint
CREATE TYPE "public"."locale" AS ENUM('sr', 'en', 'ru');--> statement-breakpoint
CREATE TYPE "public"."photo_category" AS ENUM('memories', 'wedding');--> statement-breakpoint
CREATE TYPE "public"."photo_status" AS ENUM('uploading', 'pending', 'approved', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."rsvp_status" AS ENUM('pending', 'yes', 'no');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('superadmin', 'couple');--> statement-breakpoint
CREATE TABLE "email_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid,
	"profile_id" uuid,
	"kind" text NOT NULL,
	"to_email" text NOT NULL,
	"locale" "locale" DEFAULT 'sr' NOT NULL,
	"provider_id" text,
	"status" "email_status" NOT NULL,
	"error" text,
	"dedupe_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"type" "event_type" DEFAULT 'wedding' NOT NULL,
	"occasion" text DEFAULT '' NOT NULL,
	"slug" text NOT NULL,
	"partner1" text NOT NULL,
	"partner2" text DEFAULT '' NOT NULL,
	"date" date NOT NULL,
	"rsvp_deadline" date,
	"city" text DEFAULT '' NOT NULL,
	"invitation" jsonb NOT NULL,
	"settings" jsonb NOT NULL,
	"retention_months" integer DEFAULT 3 NOT NULL,
	"storage_limit_bytes" bigint DEFAULT 50000000 NOT NULL,
	"purge_at" timestamp with time zone NOT NULL,
	"purge_warned_30_at" timestamp with time zone,
	"purge_warned_7_at" timestamp with time zone,
	"purged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_retention_months_range" CHECK ("events"."retention_months" between 1 and 60),
	CONSTRAINT "events_storage_limit_positive" CHECK ("events"."storage_limit_bytes" > 0),
	CONSTRAINT "events_slug_format" CHECK ("events"."slug" ~ '^[a-z0-9-]{3,40}$')
);
--> statement-breakpoint
ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "guests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"token" text NOT NULL,
	"side" "guest_side" DEFAULT 'zajednicki' NOT NULL,
	"companions" jsonb NOT NULL,
	"max_persons" integer DEFAULT 1 NOT NULL,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opened_at" timestamp with time zone,
	"rsvp_status" "rsvp_status" DEFAULT 'pending' NOT NULL,
	"rsvp_persons" integer DEFAULT 0 NOT NULL,
	"rsvp_companions" text[] DEFAULT '{}'::text[] NOT NULL,
	"rsvp_note" text DEFAULT '' NOT NULL,
	"responded_at" timestamp with time zone,
	"notify_email" text DEFAULT '' NOT NULL,
	"notify_locale" "locale" DEFAULT 'sr' NOT NULL,
	"notify_requested_at" timestamp with time zone,
	"notify_sent_at" timestamp with time zone,
	"notify_claimed_at" timestamp with time zone,
	"notify_claim_token" uuid,
	CONSTRAINT "guests_side_range" CHECK ("guests"."side" in ('mlada', 'mladozenja', 'zajednicki')),
	CONSTRAINT "guests_rsvp_persons_range" CHECK ("guests"."rsvp_persons" >= 0)
);
--> statement-breakpoint
ALTER TABLE "guests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "photo_subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"locale" "locale" DEFAULT 'sr' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"claimed_at" timestamp with time zone,
	"claim_token" uuid
);
--> statement-breakpoint
ALTER TABLE "photo_subscribers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"guest_id" uuid,
	"sender_name" text DEFAULT '' NOT NULL,
	"category" "photo_category" DEFAULT 'wedding' NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"status" "photo_status" DEFAULT 'uploading' NOT NULL,
	"upload_key_hash" text,
	"original_path" text,
	"web_path" text,
	"thumb_path" text,
	"mime" text,
	"size_bytes" bigint,
	"width" integer,
	"height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"uploaded_at" timestamp with time zone,
	CONSTRAINT "photos_size_bytes_positive" CHECK ("photos"."size_bytes" is null or "photos"."size_bytes" > 0)
);
--> statement-breakpoint
ALTER TABLE "photos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"role" "user_role" DEFAULT 'couple' NOT NULL,
	"email" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"locale" "locale" DEFAULT 'sr' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"tokens_valid_after" timestamp with time zone,
	"terms_accepted_at" timestamp with time zone,
	"terms_version" text,
	"privacy_version" text,
	"onboarded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_key_window_start_pk" PRIMARY KEY("key","window_start"),
	CONSTRAINT "rate_limits_count_positive" CHECK ("rate_limits"."count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "rate_limits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guests" ADD CONSTRAINT "guests_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_subscribers" ADD CONSTRAINT "photo_subscribers_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_log_dedupe_key_unique" ON "email_log" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "email_log_event_idx" ON "email_log" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "email_log_created_idx" ON "email_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "events_slug_unique" ON "events" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "events_owner_unique" ON "events" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "events_purge_at_idx" ON "events" USING btree ("purge_at");--> statement-breakpoint
CREATE UNIQUE INDEX "guests_token_unique" ON "guests" USING btree ("token");--> statement-breakpoint
CREATE INDEX "guests_event_idx" ON "guests" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "guests_event_rsvp_idx" ON "guests" USING btree ("event_id","rsvp_status");--> statement-breakpoint
CREATE UNIQUE INDEX "photo_subscribers_event_email_unique" ON "photo_subscribers" USING btree ("event_id","email");--> statement-breakpoint
CREATE INDEX "photo_subscribers_event_idx" ON "photo_subscribers" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "photos_event_idx" ON "photos" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "photos_event_status_created_idx" ON "photos" USING btree ("event_id","status","created_at");--> statement-breakpoint
CREATE INDEX "photos_guest_idx" ON "photos" USING btree ("guest_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_email_unique" ON "profiles" USING btree ("email");--> statement-breakpoint
CREATE INDEX "profiles_role_idx" ON "profiles" USING btree ("role");