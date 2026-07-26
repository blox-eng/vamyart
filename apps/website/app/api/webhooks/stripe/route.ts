import { NextRequest } from "next/server";
import Stripe from "stripe";
import { db, orders, productVariants, escapeHtml, renderOrderReceiptHtml, notifyWaitlistForVariant, detectRestockTransition, shouldAutoMarkSold, upsertContact, subscribeToButtondown, trackEvent } from "@vamy/db";
import { eq, sql, and, ne } from "drizzle-orm";
import { Resend } from "resend";

function inferLeadTime(productType: string | null | undefined): string {
    const t = (productType ?? "").toLowerCase();
    if (t.includes("original")) return "within 30 days";
    if (t.includes("print")) return "within 7 days";
    return "within 14 days";
}

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

      const [afterDecrement] = await tx
        .update(productVariants)
        .set({ stockQuantity: sql`GREATEST(stock_quantity - 1, 0)`, updatedAt: new Date() })
        .where(eq(productVariants.id, variantId))
        .returning({
          isOriginal: productVariants.isOriginal,
          stockQuantity: productVariants.stockQuantity,
          soldAt: productVariants.soldAt,
        });

      // A one-of-a-kind original that just sold out is gone for good — record the sale
      // timestamp so it renders as "Sold" (not restockable "Out of stock").
      if (afterDecrement && shouldAutoMarkSold(afterDecrement)) {
        await tx
          .update(productVariants)
          .set({ soldAt: new Date() })
          .where(eq(productVariants.id, variantId));
      }

      await upsertContact(tx, { email: customer?.email ?? "", name: customer?.name ?? null });

      return rows;
    });

    if (!inserted) return new Response(null, { status: 200 });

    void trackEvent("checkout.completed", { amount: session.amount_total, currency: session.currency });

    if (session.consent?.promotions === "opt_in" && customer?.email) {
      try {
        await subscribeToButtondown({
          email: customer.email,
          source: "checkout",
          locale: session.locale ?? "en",
        });
      } catch (err) {
        console.error("[stripe-webhook] buttondown subscribe failed", { orderId: inserted.id, err });
      }
    }

    try {
      const variant = await db.query.productVariants.findFirst({
        where: eq(productVariants.id, variantId),
        with: { product: { with: { artwork: true } } },
      });

      const attrs = (variant?.attributes as Record<string, string> | null) ?? {};
      const receiptHtml = renderOrderReceiptHtml({
        orderNumber: inserted.id,
        buyerName: customer?.name ?? "",
        pieceName: variant?.product?.artwork?.title ?? variant?.product?.name ?? "Your piece",
        variantName: variant?.name ?? "",
        medium: attrs.medium ?? null,
        leadTime: inferLeadTime(variant?.product?.productType),
        totalPaidEur: (session.amount_total ?? 0) / 100,
        shippingAddress: {
          line1: address?.line1 ?? null,
          line2: address?.line2 ?? null,
          city: address?.city ?? null,
          postalCode: address?.postal_code ?? null,
          country: address?.country ?? null,
        },
        termsUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://vamy.art"}/terms`,
        privacyUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://vamy.art"}/privacy`,
      });

      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL!,
        to: customer?.email ?? "",
        replyTo: "maeve@vamy.art",
        subject: `Your piece is on the way — order #${inserted.id.slice(0, 8)}`,
        html: receiptHtml,
      });
    } catch (err) {
      console.error("[stripe-webhook] receipt email failed", { orderId: inserted.id, err });
    }

    const formattedAddress = [address?.line1, address?.line2, address?.city, address?.state, address?.postal_code, address?.country]
      .filter(Boolean)
      .map(escapeHtml)
      .join(', ');

    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL!,
        to: process.env.RESEND_ARTIST_EMAIL!,
        subject: "New order received",
        html: `<p>New order from ${escapeHtml(customer?.name ?? "")} (${escapeHtml(customer?.email ?? "")}). Ship to: ${formattedAddress}.</p>`,
      });
    } catch (err) {
      console.error("[stripe-webhook] artist notification email failed", { orderId: inserted.id, err });
    }
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;

    // Stripe fires charge.refunded on PARTIAL refunds too (e.g. a goodwill shipping
    // credit). `charge.refunded` is true only when fully refunded. Restocking / un-selling
    // a piece the buyer still owns would wrongly relist it — so only run this branch on a
    // full refund.
    if (!charge.refunded) return new Response(null, { status: 200 });

    const paymentIntentId = typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;
    if (!paymentIntentId) return new Response(null, { status: 200 });

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const sessions = await stripe.checkout.sessions.list({
      payment_intent: paymentIntentId,
      limit: 1,
    });
    const session = sessions.data[0];
    if (!session) return new Response(null, { status: 200 });

    // Idempotent: only flip + restock the first time we see a refund for this order.
    const updated = await db
      .update(orders)
      .set({ status: "refunded" })
      .where(and(eq(orders.stripeSessionId, session.id), ne(orders.status, "refunded")))
      .returning({ id: orders.id, productVariantId: orders.productVariantId });
    if (updated.length === 0) return new Response(null, { status: 200 });

    const variantId = updated[0]!.productVariantId;

    const variantBefore = await db.query.productVariants.findFirst({
      where: eq(productVariants.id, variantId),
      columns: { available: true, stockQuantity: true, isOriginal: true },
    });

    const [variantAfter] = await db
      .update(productVariants)
      // Only auto-clear soldAt for originals (the auto-sold-on-purchase case). A manually
      // flagged sold variant — e.g. a print the artist sold off-platform — must stay sold;
      // refunding some other order for it should not silently relist it.
      .set({
        stockQuantity: sql`stock_quantity + 1`,
        ...(variantBefore?.isOriginal ? { soldAt: null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(productVariants.id, variantId))
      .returning({ available: productVariants.available, stockQuantity: productVariants.stockQuantity });

    const shouldNotify =
      variantBefore &&
      variantAfter &&
      detectRestockTransition(variantBefore, variantAfter);

    if (shouldNotify) {
      try {
        const result = await notifyWaitlistForVariant(variantId);
        if (result.failed > 0) {
          console.error("[stripe-webhook] some waitlist notifications failed on refund", {
            variantId,
            ...result,
          });
        }
      } catch (err) {
        console.error("[stripe-webhook] waitlist notify failed on refund", { variantId, err });
      }
    }
  }

  return new Response(null, { status: 200 });
}
