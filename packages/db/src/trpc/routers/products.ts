import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure } from "../index";
import { db } from "../../client";
import { products, productVariants, artworks } from "../../schema";

export const productsRouter = router({
  listByArtworkSlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const artwork = await db.query.artworks.findFirst({
        where: eq(artworks.slug, input.slug),
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
        },
      });
    }),

  listAll: protectedProcedure.query(async () => {
    return db.query.products.findMany({
      with: { variants: true, artwork: true },
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
        attributes: z.record(z.string()).optional(),
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
      await db
        .update(productVariants)
        .set({
          stockQuantity: input.stockQuantity,
          ...(input.available !== undefined && { available: input.available }),
          updatedAt: new Date(),
        })
        .where(eq(productVariants.id, input.id));
      return { success: true };
    }),

  updateVariant: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1),
        price: z.number().positive(),
        stockQuantity: z.number().int().min(0),
        available: z.boolean(),
      })
    )
    .mutation(async ({ input }) => {
      const [v] = await db
        .update(productVariants)
        .set({
          name: input.name,
          price: String(input.price),
          stockQuantity: input.stockQuantity,
          available: input.available,
          updatedAt: new Date(),
        })
        .where(eq(productVariants.id, input.id))
        .returning();
      return v;
    }),

  deleteVariant: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await db.delete(productVariants).where(eq(productVariants.id, input.id));
      return { success: true };
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
