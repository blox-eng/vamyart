import { NextRequest } from "next/server";
import Stripe from "stripe";
import { db, orders, productVariants } from "@vamy/db";
import { eq, sql } from "drizzle-orm";
import { Resend } from "resend";

export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY!);
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return new Response("Webhook signature invalid", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const variantId = session.metadata?.variantId;
    if (!variantId) return new Response("Missing variantId", { status: 400 });

    const address = session.shipping_details?.address;
    const customer = session.customer_details;

    await db.transaction(async (tx) => {
      await tx.insert(orders).values({
        productVariantId: variantId,
        buyerName: customer?.name ?? "Unknown",
        buyerEmail: customer?.email ?? "",
        shippingAddress: address ?? {},
        amountPaid: String((session.amount_total ?? 0) / 100),
        stripeSessionId: session.id,
        status: "paid",
      });

      await tx
        .update(productVariants)
        .set({ stockQuantity: sql`${productVariants.stockQuantity} - 1` })
        .where(eq(productVariants.id, variantId));
    });

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: customer?.email ?? "",
      subject: "Order confirmed",
      html: `<p>Thank you for your order! We'll ship it soon.</p>`,
    });

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: process.env.RESEND_ARTIST_EMAIL!,
      subject: "New order received",
      html: `<p>New order from ${customer?.name} (${customer?.email}). Ship to: ${JSON.stringify(address)}.</p>`,
    });
  }

  return new Response(null, { status: 200 });
}
