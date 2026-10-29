CREATE TABLE "measure_refs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"food" text NOT NULL,
	"preparation" text DEFAULT '' NOT NULL,
	"measure" text NOT NULL,
	"grams" numeric NOT NULL,
	"search" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "code" integer;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "nutrients" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX "measure_refs_search_idx" ON "measure_refs" USING btree ("search");