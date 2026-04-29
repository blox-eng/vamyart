import { z } from "zod";
import { eq, and, isNull, sql } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure } from "../index";
import { db } from "../../client";
import { variantWaitlist, productVariants } from "../../schema";

export const waitlistRouter = router({
  subscribe: publicProcedure
    .input(
      z.object({
        variantId: z.string().uuid(),
        email: z.string().email().toLowerCase(),
      }),
    )
    .mutation(async ({ input }) => {
      const variant = await db.query.productVariants.findFirst({
        where: eq(productVariants.id, input.variantId),
      });
      if (!variant) return { success: true };

      await db
        .insert(variantWaitlist)
        .values({ productVariantId: input.variantId, email: input.email })
        .onConflictDoUpdate({
          target: [variantWaitlist.email, variantWaitlist.productVariantId],
          set: { notifiedAt: null },
        });
      return { success: true };
    }),

  countForVariant: protectedProcedure
    .input(z.object({ variantId: z.string().uuid() }))
    .query(async ({ input }) => {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(variantWaitlist)
        .where(
          and(
            eq(variantWaitlist.productVariantId, input.variantId),
            isNull(variantWaitlist.notifiedAt),
          ),
        );
      return { count: row?.count ?? 0 };
    }),

  listForVariant: protectedProcedure
    .input(z.object({ variantId: z.string().uuid() }))
    .query(async ({ input }) => {
      return db.query.variantWaitlist.findMany({
        where: eq(variantWaitlist.productVariantId, input.variantId),
        orderBy: (t, { desc }) => [desc(t.createdAt)],
      });
    }),
});
