ALTER TYPE "public"."token_type" ADD VALUE 'verificacao';--> statement-breakpoint
CREATE TABLE "anamneses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'rascunho' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"step" integer DEFAULT 0 NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "booking_channel" SET DEFAULT 'site';--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "package_id" uuid;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "daily_quote" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "weekly_tip" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "stats_patients" integer;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "stats_years" integer;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "responsible_document" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_sub" text;--> statement-breakpoint
ALTER TABLE "anamneses" ADD CONSTRAINT "anamneses_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "anamneses_patient_version_idx" ON "anamneses" USING btree ("patient_id","version");--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Contas existentes (criadas pela equipe ou por convite) contam como e-mail confirmado.
UPDATE "users" SET "email_verified_at" = "created_at" WHERE "email_verified_at" IS NULL;--> statement-breakpoint
-- O "Agendar consulta" do site passa a levar à agenda on-line (com conta do cliente).
UPDATE "settings" SET "booking_channel" = 'site';