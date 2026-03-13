import { z } from "zod";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { router, publicProcedure } from "../index";
import { db } from "../../client";
import { productVariants, shippingMethods } from "../../schema";

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

      if (!variant) throw new Error("Variant not found");
      if (!variant.available || variant.stockQuantity <= 0) {
        throw new Error("Out of stock");
      }

      // Resolve shipping: product's assigned method, or fall back to global default
      let shippingType: "free" | "paid" | "custom" = "custom";
      let shippingCost: number | null = null;
      let shippingDisplayText = "Shipping arranged by artist";

      const method = variant.product.shippingMethod;
      if (method) {
        shippingType = method.type as "free" | "paid" | "custom";
        shippingCost = method.cost ? Number(method.cost) : null;
        shippingDisplayText = method.displayText;
      } else {
        // Fall back to global default
        const defaultMethod = await db.query.shippingMethods.findFirst({
          where: eq(shippingMethods.isDefault, true),
        });
        if (defaultMethod) {
          shippingType = defaultMethod.type as "free" | "paid" | "custom";
          shippingCost = defaultMethod.cost ? Number(defaultMethod.cost) : null;
          shippingDisplayText = defaultMethod.displayText;
        }
      }

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
          allowed_countries: ["DE", "AT", "CH", "GB", "US", "BG", "FR", "NL", "BE"],
        },
        metadata: { variantId: variant.id },
        success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/order/success?session={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}`,
      };

      if (shippingType === "paid" && shippingCost != null) {
        sessionParams.shipping_options = [
          {
            shipping_rate_data: {
              type: "fixed_amount",
              fixed_amount: { amount: Math.round(shippingCost * 100), currency: "eur" },
              display_name: shippingDisplayText,
            },
          },
        ];
      }

      const session = await getStripe().checkout.sessions.create(sessionParams);

      return { url: session.url! };
    }),
});
