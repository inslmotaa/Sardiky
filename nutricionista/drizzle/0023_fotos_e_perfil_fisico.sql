CREATE TABLE "height_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"date" date NOT NULL,
	"height_cm" numeric NOT NULL,
	"source" "measurement_source" NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photo_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"date" date NOT NULL,
	"measurement_id" uuid,
	"coach_comment" text,
	"commented_by" uuid,
	"commented_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "diary_entries" ADD COLUMN "professional_reaction" text;--> statement-breakpoint
ALTER TABLE "height_logs" ADD CONSTRAINT "height_logs_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "height_logs" ADD CONSTRAINT "height_logs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_sets" ADD CONSTRAINT "photo_sets_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_sets" ADD CONSTRAINT "photo_sets_measurement_id_measurements_id_fk" FOREIGN KEY ("measurement_id") REFERENCES "public"."measurements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_sets" ADD CONSTRAINT "photo_sets_commented_by_users_id_fk" FOREIGN KEY ("commented_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "height_logs_patient_idx" ON "height_logs" USING btree ("patient_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "photo_sets_patient_date_idx" ON "photo_sets" USING btree ("patient_id","date");