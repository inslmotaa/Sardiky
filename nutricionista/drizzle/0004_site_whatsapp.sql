ALTER TABLE "settings" ADD COLUMN "show_prices" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "booking_channel" text DEFAULT 'whatsapp' NOT NULL;