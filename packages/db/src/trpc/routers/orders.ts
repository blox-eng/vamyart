import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { router, publicProcedure } from "../index";
import { db } from "../../client";
import { orders } from "../../schema";
import { Resend } from "resend";

export const ordersRouter = router({
  list: publicProcedure.query(async () => {
    return db.query.orders.findMany({
      with: { productVariant: { with: { product: true } } },
      orderBy: [desc(orders.createdAt)],
    });
  }),

  markShipped: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        trackingNumber: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const [order] = await db
        .update(orders)
        .set({
          status: "shipped",
          trackingNumber: input.trackingNumber,
          shippedAt: new Date(),
        })
        .where(eq(orders.id, input.id))
        .returning();

      if (input.trackingNumber) {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL!,
          to: order.buyerEmail,
          subject: "Your order has shipped",
          html: `<p>Hi ${order.buyerName}, your order is on its way! Tracking: ${input.trackingNumber}</p>`,
        });
      }

      return { success: true };
    }),
});
