import { NextRequest } from "next/server";
import Stripe from "stripe";
import { db, orders, productVariants, escapeHtml } from "@vamy/db";
import { eq, sql } from "drizzle-orm";
import { Resend } from "resend";

export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY!);
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing stripe-signature header", { status: 400 });;

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

    const [inserted] = await db.transaction(async (tx) => {
      const rows = await tx
        .insert(orders)
        .values({
          productVariantId: variantId,
          buyerName: customer?.name ?? "Unknown",
          buyerEmail: customer?.email ?? "",
          shippingAddress: address ?? {},
          amountPaid: String((session.amount_total ?? 0) / 100),
          stripeSessionId: session.id,
          status: "paid",
        })
        .onConflictDoNothing()
        .returning();

      if (rows.length === 0) return rows;

      await tx
        .update(productVariants)
        .set({ stockQuantity: sql`GREATEST(stock_quantity - 1, 0)`, updatedAt: new Date() })
        .where(eq(productVariants.id, variantId));

      return rows;
    });

    if (!inserted) return new Response(null, { status: 200 });

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: customer?.email ?? "",
      subject: "Order confirmed",
      html: `<p>Thank you for your order! We'll ship it soon.</p>`,
    });

    const formattedAddress = [address?.line1, address?.line2, address?.city, address?.state, address?.postal_code, address?.country]
      .filter(Boolean)
      .map(escapeHtml)
      .join(', ');

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: process.env.RESEND_ARTIST_EMAIL!,
      subject: "New order received",
      html: `<p>New order from ${escapeHtml(customer?.name ?? "")} (${escapeHtml(customer?.email ?? "")}). Ship to: ${formattedAddress}.</p>`,
    });
  }

  return new Response(null, { status: 200 });
}
