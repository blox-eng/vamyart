import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
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
      return db.transaction(async (tx) => {
        if (input.isDefault) {
          await tx.update(shippingMethods).set({ isDefault: false, updatedAt: new Date() })
            .where(eq(shippingMethods.isDefault, true));
        }
        const [sm] = await tx.insert(shippingMethods).values({
          name: input.name,
          displayText: input.displayText,
          type: input.type,
          cost: input.cost != null ? String(input.cost) : null,
          isDefault: input.isDefault ?? false,
        }).returning();
        return sm;
      });
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
      return db.transaction(async (tx) => {
        if (input.isDefault === true) {
          await tx.update(shippingMethods).set({ isDefault: false, updatedAt: new Date() })
            .where(eq(shippingMethods.isDefault, true));
        }
        if (input.isDefault === false) {
          const current = await tx.query.shippingMethods.findFirst({
            where: (sm, { and, eq: eqFn }) => and(eqFn(sm.id, input.id), eqFn(sm.isDefault, true)),
          });
          if (current) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Cannot remove default status without setting another method as default first",
            });
          }
        }
        const { id, cost, isDefault, ...rest } = input;
        const updateData: Record<string, unknown> = { ...rest, updatedAt: new Date() };
        if (isDefault !== undefined) updateData.isDefault = isDefault;
        if (cost !== undefined) updateData.cost = cost != null ? String(cost) : null;
        const [sm] = await tx.update(shippingMethods).set(updateData).where(eq(shippingMethods.id, id)).returning();
        if (!sm) throw new TRPCError({ code: "NOT_FOUND", message: "Shipping method not found" });
        return sm;
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const inUse = await db.query.products.findFirst({
        where: (p, { eq }) => eq(p.shippingMethodId, input.id),
      });
      if (inUse) throw new TRPCError({ code: "CONFLICT", message: "Cannot delete: shipping method is in use by products" });

      const inUseDefault = await db.query.shippingMethods.findFirst({
        where: (sm, { and, eq }) => and(eq(sm.id, input.id), eq(sm.isDefault, true)),
      });
      if (inUseDefault) throw new TRPCError({ code: "CONFLICT", message: "Cannot delete the default shipping method" });

      await db.delete(shippingMethods).where(eq(shippingMethods.id, input.id));
      return { success: true };
    }),
});
