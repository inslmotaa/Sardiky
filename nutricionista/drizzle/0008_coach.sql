ALTER TABLE "settings" ALTER COLUMN "professional_title" SET DEFAULT 'Coach';--> statement-breakpoint
-- Título público passa a ser "Coach" e o CRN deixa de aparecer no site, no app e no PDF.
UPDATE "settings" SET "professional_title" = 'Coach' WHERE "professional_title" = 'Nutricionista';--> statement-breakpoint
UPDATE "settings" SET "registry" = NULL WHERE "registry" ILIKE 'CRN%';