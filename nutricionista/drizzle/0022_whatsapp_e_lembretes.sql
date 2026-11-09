CREATE TABLE "contact_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"kind" text DEFAULT 'whatsapp' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"ok" boolean NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminder_channels" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"calendar_token_hash" text,
	"calendar_token_at" timestamp with time zone,
	"calendar_downloaded_hash" text,
	"calendar_downloaded_at" timestamp with time zone,
	"unsubscribe_token" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "notification_prefs" SET DEFAULT '{"refeicoes":true,"agua":true,"plano":true,"mensagens":true,"consultas":true,"lembretes":true,"pesagem":true,"quietStart":"22:00","quietEnd":"07:00","waterEveryH":2,"waterStart":"08:00","waterEnd":"20:00","emailResumo":false}'::jsonb;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "chat_mode" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "chat_mode" text DEFAULT 'ambos' NOT NULL;--> statement-breakpoint
ALTER TABLE "contact_events" ADD CONSTRAINT "contact_events_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_channels" ADD CONSTRAINT "reminder_channels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_events_patient_idx" ON "contact_events" USING btree ("patient_id","created_at");--> statement-breakpoint
CREATE INDEX "email_log_created_idx" ON "email_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reminder_channels_calendar_idx" ON "reminder_channels" USING btree ("calendar_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "reminder_channels_unsub_idx" ON "reminder_channels" USING btree ("unsubscribe_token");