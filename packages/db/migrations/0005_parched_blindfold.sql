CREATE TABLE "variant_waitlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_variant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notified_at" timestamp with time zone,
	CONSTRAINT "variant_waitlist_email_variant_unique" UNIQUE("email","product_variant_id")
);
--> statement-breakpoint
ALTER TABLE "variant_waitlist" ADD CONSTRAINT "variant_waitlist_product_variant_id_product_variants_id_fk" FOREIGN KEY ("product_variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;