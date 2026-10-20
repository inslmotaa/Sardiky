CREATE TABLE "progress_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"date" date NOT NULL,
	"angle" text NOT NULL,
	"file_id" uuid NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_success_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "reminder_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "diary_entries" ADD COLUMN "meal_key" text;--> statement-breakpoint
ALTER TABLE "diary_entries" ADD COLUMN "items" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "diary_entries" ADD COLUMN "mood" smallint;--> statement-breakpoint
ALTER TABLE "diary_entries" ADD COLUMN "commented_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "measurements" ADD COLUMN "abdomen_cm" numeric;--> statement-breakpoint
ALTER TABLE "measurements" ADD COLUMN "calf_cm" numeric;--> statement-breakpoint
ALTER TABLE "measurements" ADD COLUMN "skinfolds" jsonb;--> statement-breakpoint
ALTER TABLE "measurements" ADD COLUMN "skinfold_protocol" text;--> statement-breakpoint
ALTER TABLE "measurements" ADD COLUMN "bioimpedance" jsonb;--> statement-breakpoint
ALTER TABLE "measurements" ADD COLUMN "lean_mass_kg" numeric;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "attachment_file_id" uuid;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "diary_entry_id" uuid;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "automatic" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "adherence_good" integer DEFAULT 80 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "adherence_low" integer DEFAULT 40 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "quick_replies" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "chat_hours" jsonb;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "chat_auto_reply" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "notification_prefs" jsonb DEFAULT '{"refeicoes":true,"agua":true,"plano":true,"mensagens":true,"consultas":true,"lembretes":true,"pesagem":true,"quietStart":"22:00","quietEnd":"07:00","waterEveryH":2,"waterStart":"08:00","waterEnd":"20:00"}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "progress_photos" ADD CONSTRAINT "progress_photos_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_photos" ADD CONSTRAINT "progress_photos_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_photos" ADD CONSTRAINT "progress_photos_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_log" ADD CONSTRAINT "reminder_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "progress_photos_patient_idx" ON "progress_photos" USING btree ("patient_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "push_endpoint_idx" ON "push_subscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "push_user_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reminder_log_unique" ON "reminder_log" USING btree ("user_id","kind","key");