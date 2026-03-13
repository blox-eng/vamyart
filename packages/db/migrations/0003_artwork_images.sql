CREATE TABLE "artwork_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artwork_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"alt_text" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "artwork_images" ADD CONSTRAINT "artwork_images_artwork_id_artworks_id_fk" FOREIGN KEY ("artwork_id") REFERENCES "public"."artworks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
-- Only one primary image per artwork
CREATE UNIQUE INDEX artwork_images_one_primary
  ON artwork_images (artwork_id) WHERE (is_primary = true);
--> statement-breakpoint
-- Fast lookup by artwork
CREATE INDEX artwork_images_artwork_id ON artwork_images (artwork_id);
--> statement-breakpoint
-- RLS
ALTER TABLE artwork_images ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "Allow public read access on artwork_images"
  ON artwork_images FOR SELECT USING (true);