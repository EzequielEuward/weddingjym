CREATE TYPE "public"."deleted_by_role" AS ENUM('author', 'moderator');--> statement-breakpoint
CREATE TYPE "public"."event_mode" AS ENUM('live', 'read_only', 'closed');--> statement-breakpoint
CREATE TYPE "public"."photo_section" AS ENUM('general', 'best_outfit', 'best_bloopers');--> statement-breakpoint
CREATE TABLE "event_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"mode" "event_mode" DEFAULT 'live' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_settings_singleton_chk" CHECK ("event_settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "guest_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"alias" varchar(30),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"guest_session_id" uuid NOT NULL,
	"author_alias_snapshot" varchar(30) NOT NULL,
	"section" "photo_section" NOT NULL,
	"caption" varchar(80),
	"storage_key_full" varchar(255) NOT NULL,
	"storage_key_thumb" varchar(255) NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"size_bytes" integer NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" "deleted_by_role",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"photo_id" uuid NOT NULL,
	"guest_session_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_guest_session_id_guest_sessions_id_fk" FOREIGN KEY ("guest_session_id") REFERENCES "public"."guest_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_guest_session_id_guest_sessions_id_fk" FOREIGN KEY ("guest_session_id") REFERENCES "public"."guest_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_photos_section_created" ON "photos" USING btree ("section","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_votes_photo_guest_session" ON "votes" USING btree ("photo_id","guest_session_id");--> statement-breakpoint
CREATE INDEX "idx_votes_photo_id" ON "votes" USING btree ("photo_id");