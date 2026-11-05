ALTER TABLE "testimonials" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "testimonials" CASCADE;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "payment_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "provider_preference_id" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "provider_status" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "mp_max_installments" integer DEFAULT 12 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "mp_statement_descriptor" text DEFAULT 'FARION' NOT NULL;--> statement-breakpoint
CREATE INDEX "payments_provider_ref_idx" ON "payments" USING btree ("provider_ref");