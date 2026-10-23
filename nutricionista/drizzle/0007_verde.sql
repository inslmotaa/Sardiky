ALTER TABLE "settings" ALTER COLUMN "brand_color" SET DEFAULT '#2f8f57';--> statement-breakpoint
-- Nova paleta: troca o verde antigo padrão pelo verde principal (cores escolhidas pelo consultório são mantidas).
UPDATE "settings" SET "brand_color" = '#2f8f57' WHERE lower("brand_color") = '#2f5d50';