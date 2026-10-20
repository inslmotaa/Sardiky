CREATE TABLE "materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"url" text,
	"file_id" uuid,
	"audience" text DEFAULT 'todos' NOT NULL,
	"patient_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prescriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"dose" text,
	"schedule" text,
	"duration" text,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"photo_file_id" uuid,
	"ingredients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"final_weight_g" numeric,
	"portions" integer DEFAULT 1 NOT NULL,
	"prep_minutes" integer,
	"instructions" text DEFAULT '' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"visible_to_all" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "reminder_2h_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "patient_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "reschedule_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "reschedule_note" text;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "rating" smallint;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "rating_comment" text;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "rated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "form_assignments" ADD COLUMN "source" text DEFAULT 'nativa' NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "restrictions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "nutritionist_id" uuid;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "signature_text" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "signature_file_id" uuid;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "default_meals" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "auto_anamnesis_template_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "own_patients_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prescriptions_patient_idx" ON "prescriptions" USING btree ("patient_id");--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_nutritionist_id_users_id_fk" FOREIGN KEY ("nutritionist_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;