CREATE TABLE "critique_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artwork_id" uuid,
	"storage_path" text NOT NULL,
	"prompt" text,
	"white_balance" jsonb,
	"palette" jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"model" text,
	"result" jsonb,
	"error" text,
	"cost_usd" numeric(10, 6),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand" text NOT NULL,
	"name" text NOT NULL,
	"medium" text DEFAULT 'oil' NOT NULL,
	"pigments" text[] NOT NULL,
	"hex" text NOT NULL,
	"opacity" text,
	"source" text NOT NULL,
	"owned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "paints_brand_name_medium_unique" UNIQUE("brand","name","medium")
);
--> statement-breakpoint
ALTER TABLE "artworks" ADD COLUMN "palette" jsonb;--> statement-breakpoint
ALTER TABLE "artworks" ADD COLUMN "show_palette" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "critique_runs" ADD CONSTRAINT "critique_runs_artwork_id_artworks_id_fk" FOREIGN KEY ("artwork_id") REFERENCES "public"."artworks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- All access goes through tRPC (server-side connection, bypasses RLS); block direct anon-key access.
ALTER TABLE "paints" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "critique_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Private: work-in-progress photos are only ever read through short-lived signed URLs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('critique-uploads', 'critique-uploads', false, 26214400, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;
