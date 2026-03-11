-- Create enums (idempotent)
DO $$ BEGIN
  CREATE TYPE shipping_method_type AS ENUM ('free', 'paid', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE banner_scope AS ENUM ('global', 'page');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- shipping_methods table
CREATE TABLE IF NOT EXISTS "shipping_methods" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "display_text" text NOT NULL,
  "type" shipping_method_type NOT NULL,
  "cost" numeric(10, 2),
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- banners table
CREATE TABLE IF NOT EXISTS "banners" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "text" text NOT NULL,
  "is_active" boolean NOT NULL DEFAULT false,
  "scope" banner_scope NOT NULL DEFAULT 'global',
  "page_slug" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- FK columns (add if not exists)
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "shipping_method_id" uuid REFERENCES "shipping_methods"("id");
ALTER TABLE "auctions" ADD COLUMN IF NOT EXISTS "product_variant_id" uuid REFERENCES "product_variants"("id");

-- RLS on new tables
ALTER TABLE "shipping_methods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "banners" ENABLE ROW LEVEL SECURITY;

-- Public read policies (service role bypasses RLS for writes)
DO $$ BEGIN
  CREATE POLICY "shipping_methods_public_read" ON "shipping_methods"
    FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "banners_public_read" ON "banners"
    FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
