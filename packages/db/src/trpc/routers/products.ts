import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, isNull } from "drizzle-orm";
import { detectRestockTransition, notifyWaitlistForVariant } from "../../services/restock-notify";
import { router, publicProcedure, protectedProcedure } from "../index";
import { db } from "../../client";
import { products, productVariants, artworks, orders, auctions } from "../../schema";

// Orders and auctions reference a variant with RESTRICT — deleting a variant they
// point at would orphan financial/auction history, so block it (deactivate instead).
// variant_waitlist cascades, so it needs no guard.
export function variantDeleteBlockReason(input: {
  orderCount: number;
  auctionCount: number;
}): string | null {
  if (input.orderCount > 0) {
    return "This variant has orders and cannot be deleted. Mark it unavailable instead.";
  }
  if (input.auctionCount > 0) {
    return "This variant is linked to an auction and cannot be deleted.";
  }
  return null;
}

export const productsRouter = router({
  getFeatured: publicProcedure.query(async () => {
    return db.query.products.findFirst({
      where: and(eq(products.active, true), eq(products.featured, true)),
      with: { artwork: true, variants: true },
    });
  }),

  getByArtworkSlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const artwork = await db.query.artworks.findFirst({
        where: and(eq(artworks.slug, input.slug), isNull(artworks.deletedAt)),
      });
      if (!artwork) return null;
      const product = await db.query.products.findFirst({
        where: and(eq(products.artworkId, artwork.id), eq(products.active, true)),
        with: { variants: true },
      });
      if (!product) return null;
      return { ...product, artwork };
    }),

  setFeatured: protectedProcedure
    .input(z.object({ productId: z.string().uuid(), featured: z.boolean() }))
    .mutation(async ({ input }) => {
      await db.transaction(async (tx) => {
        await tx.update(products).set({ featured: false, updatedAt: new Date() });
        if (input.featured) {
          await tx
            .update(products)
            .set({ featured: true, updatedAt: new Date() })
            .where(eq(products.id, input.productId));
        }
      });
      return { success: true };
    }),

  listByArtworkSlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const artwork = await db.query.artworks.findFirst({
        where: and(eq(artworks.slug, input.slug), isNull(artworks.deletedAt)),
      });
      if (!artwork) return [];

      return db.query.products.findMany({
        where: and(
          eq(products.artworkId, artwork.id),
          eq(products.active, true)
        ),
        with: {
          variants: {
            where: eq(productVariants.available, true),
          },
          shippingMethod: true,
        },
      });
    }),

  listAll: protectedProcedure.query(async () => {
    return db.query.products.findMany({
      with: { variants: true, artwork: true, shippingMethod: true },
      orderBy: (products, { desc }) => [desc(products.createdAt)],
    });
  }),

  createVariant: protectedProcedure
    .input(
      z.object({
        productId: z.string().uuid(),
        name: z.string().min(1),
        price: z.number().positive(),
        stockQuantity: z.number().int().min(0),
        attributes: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const [variant] = await db
        .insert(productVariants)
        .values({
          productId: input.productId,
          name: input.name,
          price: String(input.price),
          stockQuantity: input.stockQuantity,
          attributes: input.attributes,
        })
        .returning();
      return variant;
    }),

  updateVariantStock: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        stockQuantity: z.number().int().min(0),
        available: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const before = await db.query.productVariants.findFirst({
        where: eq(productVariants.id, input.id),
        columns: { available: true, stockQuantity: true },
      });
      if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Variant not found" });

      await db
        .update(productVariants)
        .set({
          stockQuantity: input.stockQuantity,
          ...(input.available !== undefined && { available: input.available }),
          updatedAt: new Date(),
        })
        .where(eq(productVariants.id, input.id));

      const after = {
        available: input.available ?? before.available,
        stockQuantity: input.stockQuantity,
      };
      let notified = 0;
      let failed = 0;
      if (detectRestockTransition(before, after)) {
        ({ notified, failed } = await notifyWaitlistForVariant(input.id));
      }
      return { success: true, notified, failed };
    }),

  updateVariant: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1),
        price: z.number().positive(),
        stockQuantity: z.number().int().min(0),
        available: z.boolean(),
        attributes: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const before = await db.query.productVariants.findFirst({
        where: eq(productVariants.id, input.id),
        columns: { available: true, stockQuantity: true },
      });
      if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Variant not found" });

      const [v] = await db
        .update(productVariants)
        .set({
          name: input.name,
          price: String(input.price),
          stockQuantity: input.stockQuantity,
          available: input.available,
          ...(input.attributes !== undefined && { attributes: input.attributes }),
          updatedAt: new Date(),
        })
        .where(eq(productVariants.id, input.id))
        .returning();

      const after = { available: input.available, stockQuantity: input.stockQuantity };
      let notified = 0;
      let failed = 0;
      if (detectRestockTransition(before, after)) {
        ({ notified, failed } = await notifyWaitlistForVariant(input.id));
      }
      return { ...v, notified, failed };
    }),

  deleteVariant: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const orderRows = await db
        .select({ id: orders.id })
        .from(orders)
        .where(eq(orders.productVariantId, input.id));
      const auctionRows = await db
        .select({ id: auctions.id })
        .from(auctions)
        .where(eq(auctions.productVariantId, input.id));

      const blockReason = variantDeleteBlockReason({
        orderCount: orderRows.length,
        auctionCount: auctionRows.length,
      });
      if (blockReason) {
        throw new TRPCError({ code: "CONFLICT", message: blockReason });
      }

      // variant_waitlist rows cascade automatically.
      await db.delete(productVariants).where(eq(productVariants.id, input.id));
      return { success: true };
    }),

  // Pure visibility flip — deliberately NOT updateVariantStock, which would trip
  // detectRestockTransition and email the waitlist when re-showing a variant.
  setVariantAvailable: protectedProcedure
    .input(z.object({ id: z.string().uuid(), available: z.boolean() }))
    .mutation(async ({ input }) => {
      const [v] = await db
        .update(productVariants)
        .set({ available: input.available, updatedAt: new Date() })
        .where(eq(productVariants.id, input.id))
        .returning();
      if (!v) throw new TRPCError({ code: "NOT_FOUND", message: "Variant not found" });
      return v;
    }),

  updateProduct: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1),
        description: z.string().optional(),
        active: z.boolean(),
      })
    )
    .mutation(async ({ input }) => {
      const [p] = await db
        .update(products)
        .set({
          name: input.name,
          description: input.description,
          active: input.active,
          updatedAt: new Date(),
        })
        .where(eq(products.id, input.id))
        .returning();
      return p;
    }),

  deleteProduct: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await db.transaction(async (tx) => {
        await tx.delete(productVariants).where(eq(productVariants.productId, input.id));
        await tx.delete(products).where(eq(products.id, input.id));
      });
      return { success: true };
    }),

  updateShippingMethod: protectedProcedure
    .input(
      z.object({
        productId: z.string().uuid(),
        shippingMethodId: z.string().uuid().nullable(),
      })
    )
    .mutation(async ({ input }) => {
      const [p] = await db
        .update(products)
        .set({ shippingMethodId: input.shippingMethodId, updatedAt: new Date() })
        .where(eq(products.id, input.productId))
        .returning();
      if (!p) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      return p;
    }),

  createProduct: protectedProcedure
    .input(
      z.object({
        artworkId: z.string().uuid(),
        productType: z.string().min(1),
        name: z.string().min(1),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const [p] = await db
        .insert(products)
        .values({
          artworkId: input.artworkId,
          productType: input.productType,
          name: input.name,
          description: input.description,
        })
        .returning();
      return p;
    }),
});
