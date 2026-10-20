CREATE TABLE "foods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"search" text NOT NULL,
	"group" text NOT NULL,
	"source" text DEFAULT 'TACO' NOT NULL,
	"kcal" numeric NOT NULL,
	"protein" numeric NOT NULL,
	"carbs" numeric NOT NULL,
	"fat" numeric NOT NULL,
	"fiber" numeric DEFAULT 0 NOT NULL,
	"sodium" numeric,
	"cooking_factor" numeric,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household_measures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"food_id" uuid NOT NULL,
	"name" text NOT NULL,
	"grams" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"date" date NOT NULL,
	"plan_id" uuid,
	"meal_key" text NOT NULL,
	"option_id" text,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "water_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"date" date NOT NULL,
	"ml" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "sex" text;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "height_cm" numeric;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "features" jsonb DEFAULT '{"diario":true,"peso":true,"chat":true,"calorias":true,"macros":true,"calculadoras":true,"agua":true}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "energy" jsonb;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "anamnesis_received_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "anamnesis_notes" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "anamnese_url" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "water_ml_per_kg" integer DEFAULT 35 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_measures" ADD CONSTRAINT "household_measures_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_logs" ADD CONSTRAINT "meal_logs_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_logs" ADD CONSTRAINT "meal_logs_plan_id_meal_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."meal_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "water_logs" ADD CONSTRAINT "water_logs_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "foods_search_idx" ON "foods" USING btree ("search");--> statement-breakpoint
CREATE INDEX "measures_food_idx" ON "household_measures" USING btree ("food_id");--> statement-breakpoint
CREATE UNIQUE INDEX "meal_logs_unique" ON "meal_logs" USING btree ("patient_id","date","meal_key");--> statement-breakpoint
CREATE UNIQUE INDEX "water_logs_unique" ON "water_logs" USING btree ("patient_id","date");