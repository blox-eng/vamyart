import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure } from "../index";
import { db } from "../../client";
import { shippingMethods, products } from "../../schema";

export const shippingMethodsRouter = router({
  list: protectedProcedure.query(async () => {
    return db.query.shippingMethods.findMany({
      orderBy: (sm, { asc }) => [asc(sm.name)],
    });
  }),

  getDefault: publicProcedure.query(async () => {
    return db.query.shippingMethods.findFirst({
      where: eq(shippingMethods.isDefault, true),
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        displayText: z.string().min(1),
        type: z.enum(["free", "paid", "custom"]),
        cost: z.number().positive().optional(),
        isDefault: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      if (input.isDefault === true) {
        await db
          .update(shippingMethods)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(eq(shippingMethods.isDefault, true));
      }

      const [sm] = await db
        .insert(shippingMethods)
        .values({
          name: input.name,
          displayText: input.displayText,
          type: input.type,
          cost: input.cost != null ? String(input.cost) : null,
          isDefault: input.isDefault,
        })
        .returning();
      return sm;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        displayText: z.string().min(1).optional(),
        type: z.enum(["free", "paid", "custom"]).optional(),
        cost: z.number().positive().nullable().optional(),
        isDefault: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, cost, ...fields } = input;

      if (input.isDefault === true) {
        await db
          .update(shippingMethods)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(eq(shippingMethods.isDefault, true));
      }

      const updateData: Record<string, unknown> = { ...fields, updatedAt: new Date() };
      if (cost !== undefined) updateData.cost = cost != null ? String(cost) : null;

      const [sm] = await db
        .update(shippingMethods)
        .set(updateData)
        .where(eq(shippingMethods.id, id))
        .returning();
      return sm;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const inUse = await db.query.products.findFirst({
        where: (p, { eq }) => eq(p.shippingMethodId, input.id),
      });
      if (inUse) throw new Error("Cannot delete: shipping method is in use by products");

      const inUseDefault = await db.query.shippingMethods.findFirst({
        where: (sm, { and, eq }) => and(eq(sm.id, input.id), eq(sm.isDefault, true)),
      });
      if (inUseDefault) throw new Error("Cannot delete the default shipping method");

      await db.delete(shippingMethods).where(eq(shippingMethods.id, input.id));
      return { success: true };
    }),
});
