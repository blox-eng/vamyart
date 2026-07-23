-- Index already created by 0011 (raw SQL); this migration only registers it in
-- drizzle's snapshot state so future `generate` runs don't try to re-create it.
CREATE UNIQUE INDEX IF NOT EXISTS "certificates_variant_edition_unique" ON "certificates" USING btree ("product_variant_id","edition_number") WHERE "product_variant_id" IS NOT NULL AND "edition_number" IS NOT NULL AND "deleted_at" IS NULL;