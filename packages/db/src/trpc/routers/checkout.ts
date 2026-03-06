import { z } from "zod";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { router, publicProcedure } from "../index";
import { db } from "../../client";
import { productVariants } from "../../schema";

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
            with: { artwork: true },
          },
        },
      });

      if (!variant) throw new Error("Variant not found");
      if (!variant.available || variant.stockQuantity <= 0) {
        throw new Error("Out of stock");
      }

      const session = await getStripe().checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
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
          allowed_countries: ["DE", "AT", "CH", "GB", "US", "BG", "FR", "NL", "BE"],
        },
        metadata: { variantId: variant.id },
        success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/order/success?session={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}`,
      });

      return { url: session.url! };
    }),
});
