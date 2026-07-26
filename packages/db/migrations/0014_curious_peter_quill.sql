ALTER TABLE "product_variants" ADD COLUMN "is_original" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "sold_at" timestamp with time zone;