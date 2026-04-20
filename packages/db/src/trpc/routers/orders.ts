import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { router, protectedProcedure } from "../index";
import { db } from "../../client";
import { orders, productVariants } from "../../schema";
import { Resend } from "resend";
import { renderOrderTrackingHtml } from "../../emails/order-tracking";

export const ordersRouter = router({
  list: protectedProcedure.query(async () => {
    return db.query.orders.findMany({
      with: { productVariant: { with: { product: { with: { artwork: true } } } } },
      orderBy: [desc(orders.createdAt)],
    });
  }),

  markShipped: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        carrier: z.enum(["DHL", "GLS", "UPS", "Econt", "Other"]),
        trackingNumber: z.string().min(1),
        note: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const resend = new Resend(process.env.RESEND_API_KEY);

      const [order] = await db
        .update(orders)
        .set({
          status: "shipped",
          trackingCarrier: input.carrier,
          trackingNumber: input.trackingNumber,
          shippedAt: new Date(),
        })
        .where(eq(orders.id, input.id))
        .returning();

      if (!order) {
        throw new Error("order not found");
      }

      const variant = await db.query.productVariants.findFirst({
        where: eq(productVariants.id, order.productVariantId),
        with: { product: { with: { artwork: true } } },
      });

      const pieceName = variant?.product?.artwork?.title ?? variant?.product?.name ?? "Your piece";
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vamy.art";

      try {
        const html = renderOrderTrackingHtml({
          orderNumber: order.id,
          buyerName: order.buyerName,
          pieceName,
          carrier: input.carrier,
          trackingNumber: input.trackingNumber,
          note: input.note ?? null,
          termsUrl: `${siteUrl}/terms`,
          privacyUrl: `${siteUrl}/privacy`,
        });

        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL!,
          to: order.buyerEmail,
          replyTo: "maeve@vamy.art",
          subject: "Your piece has shipped — tracking inside",
          html,
        });
      } catch (err) {
        console.error("[orders.markShipped] tracking email failed", { orderId: order.id, err });
      }

      return { success: true };
    }),
});
