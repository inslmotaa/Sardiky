ALTER TYPE "public"."token_type" ADD VALUE 'link_magico';--> statement-breakpoint
CREATE TABLE "checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"due_date" date NOT NULL,
	"status" text DEFAULT 'pendente' NOT NULL,
	"submitted_at" timestamp with time zone,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"weight_kg" numeric,
	"measures" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"photo_file_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"measurement_id" uuid,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"coach_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "patients" ALTER COLUMN "features" SET DEFAULT '{"diario":true,"peso":true,"chat":true,"calorias":true,"macros":true,"calculadoras":true,"agua":true,"fotosCorpo":true,"exames":true,"micronutrientes":false}'::jsonb;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "barcode" text;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "checkin_every_days" integer;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "next_checkin_due" date;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "mp_preapproval_id" text;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "mp_preapproval_status" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "receipt_number" integer;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_measurement_id_measurements_id_fk" FOREIGN KEY ("measurement_id") REFERENCES "public"."measurements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "checkins_patient_due_idx" ON "checkins" USING btree ("patient_id","due_date");--> statement-breakpoint
CREATE INDEX "checkins_status_idx" ON "checkins" USING btree ("status","due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "foods_barcode_idx" ON "foods" USING btree ("barcode");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_receipt_idx" ON "payments" USING btree ("receipt_number");