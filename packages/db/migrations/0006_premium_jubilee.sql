ALTER TABLE "artworks" ADD COLUMN "excerpt" text;--> statement-breakpoint
ALTER TABLE "artworks" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "artworks" ADD COLUMN "featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "artworks" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "artworks" ADD COLUMN "seo_title" text;--> statement-breakpoint
ALTER TABLE "artworks" ADD COLUMN "seo_description" text;