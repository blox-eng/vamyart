ALTER TABLE "artwork_images" ADD COLUMN "width" integer;--> statement-breakpoint
ALTER TABLE "artwork_images" ADD COLUMN "height" integer;--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "on_landing" boolean DEFAULT true NOT NULL;