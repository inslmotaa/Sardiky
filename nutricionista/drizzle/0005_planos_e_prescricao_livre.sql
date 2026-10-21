ALTER TABLE "packages" ADD COLUMN "months" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "packages" ADD COLUMN "perks" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "packages" ADD COLUMN "highlight" text;--> statement-breakpoint
ALTER TABLE "packages" ADD COLUMN "sort" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "show_plan_prices" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "plans_included" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
-- Pacotes já existentes: duração em meses a partir da validade em dias.
UPDATE "packages" SET "months" = GREATEST(1, ROUND("validity_days" / 30.0));