CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"cover_file_id" uuid,
	"cover_alt" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'rascunho' NOT NULL,
	"published_on" date NOT NULL,
	"author_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "form" text DEFAULT 'contato' NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "utm_source" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "utm_medium" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "utm_campaign" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "utm_content" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "utm_term" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "landing_path" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "referrer" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "pixels_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "meta_pixel_id" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "google_tag_id" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_cover_file_id_files_id_fk" FOREIGN KEY ("cover_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "posts_slug_idx" ON "posts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "posts_status_idx" ON "posts" USING btree ("status","published_on");