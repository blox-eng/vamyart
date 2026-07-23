CREATE SEQUENCE IF NOT EXISTS certificate_seq;

CREATE TABLE "certificates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "cert_number" text NOT NULL,
  "kind" text NOT NULL,
  "artwork_id" uuid NOT NULL,
  "product_variant_id" uuid,
  "edition_number" integer,
  "edition_size" integer,
  "buyer_name" text,
  "image_path" text,
  "fields_snapshot" jsonb NOT NULL,
  "issued_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  CONSTRAINT "certificates_cert_number_unique" UNIQUE("cert_number")
);

ALTER TABLE "certificates"
  ADD CONSTRAINT "certificates_artwork_id_artworks_id_fk"
  FOREIGN KEY ("artwork_id") REFERENCES "artworks"("id");

ALTER TABLE "certificates"
  ADD CONSTRAINT "certificates_product_variant_id_product_variants_id_fk"
  FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id");

-- The database itself makes "3 of 25" un-issuable twice.
CREATE UNIQUE INDEX "certificates_variant_edition_unique"
  ON "certificates" ("product_variant_id", "edition_number")
  WHERE "product_variant_id" IS NOT NULL AND "edition_number" IS NOT NULL AND "deleted_at" IS NULL;

CREATE TABLE "certificate_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "header_text" text NOT NULL,
  "studio_name" text NOT NULL,
  "statement_template" text NOT NULL,
  "copyright_line" text NOT NULL,
  "care_line" text NOT NULL,
  "signature_label" text NOT NULL,
  "logo_path" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Seed the single settings row with defaults (matches DEFAULT_CERTIFICATE_SETTINGS).
INSERT INTO "certificate_settings"
  ("header_text","studio_name","statement_template","copyright_line","care_line","signature_label")
VALUES (
  'Certificate of Authenticity',
  'VAMY',
  'I certify that “{title}” is an authentic original work created by my hand. This certificate accompanies the artwork as a record of its provenance.',
  '© Maeve — all reproduction rights reserved.',
  'Keep away from direct sunlight and humidity. Handle by the edges.',
  'Signed by hand'
);

ALTER TABLE "certificates"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "certificate_settings"  ENABLE ROW LEVEL SECURITY;
