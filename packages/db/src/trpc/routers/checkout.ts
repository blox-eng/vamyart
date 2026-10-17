import { z } from "zod";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../index";
import { db } from "../../client";
import { productVariants, shippingMethods } from "../../schema";
import { isVariantSold } from "../../services/variant-sold";
import { resolveShipping } from "../../services/shipping";
import { CHECKOUT_COUNTRIES } from "../../services/checkout-countries";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export const checkoutRouter = router({
  createSession: publicProcedure
    .input(z.object({ variantId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const variant = await db.query.productVariants.findFirst({
        where: eq(productVariants.id, input.variantId),
        with: {
          product: {
            with: { artwork: true, shippingMethod: true },
          },
        },
      });

      if (!variant) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Variant not found" });
      }
      if (variant.product.artwork?.deletedAt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Variant not found" });
      }
      if (!variant.available || variant.stockQuantity <= 0 || isVariantSold(variant)) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "OUT_OF_STOCK" });
      }

      const method = variant.product.shippingMethod;
      const defaultMethod = method
        ? null
        : await db.query.shippingMethods.findFirst({ where: eq(shippingMethods.isDefault, true) });
      const shipping = resolveShipping(method, defaultMethod);

      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "eur",
              product_data: {
                name: `${variant.product.name} — ${variant.name}`,
                metadata: { variantId: variant.id },
              },
              unit_amount: Math.round(Number(variant.price) * 100),
            },
            quantity: 1,
          },
        ],
        shipping_address_collection: {
          allowed_countries: [...CHECKOUT_COUNTRIES],
        },
        metadata: { variantId: variant.id },
        consent_collection: { promotions: "auto" },
        success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/order/success?session={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}`,
      };

      if (shipping.type === "paid" && shipping.cost != null) {
        sessionParams.shipping_options = [
          {
            shipping_rate_data: {
              type: "fixed_amount",
              fixed_amount: { amount: Math.round(shipping.cost * 100), currency: "eur" },
              display_name: shipping.displayText,
            },
          },
        ];
      }

      const session = await getStripe().checkout.sessions.create(sessionParams);

      return { url: session.url! };
    }),
});
