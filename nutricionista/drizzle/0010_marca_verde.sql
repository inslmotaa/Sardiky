ALTER TABLE "settings" ALTER COLUMN "brand_color" SET DEFAULT '#1f5e3b';--> statement-breakpoint
-- Verde da marca igual ao do site (só troca quem ainda usa o verde antigo padrão).
UPDATE "settings" SET "brand_color" = '#1f5e3b' WHERE "brand_color" = '#2f8f57';
