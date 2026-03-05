import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { router, publicProcedure } from "../index";
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

  listAll: publicProcedure.query(async () => {
    return db.query.products.findMany({
      with: { variants: true, artwork: true },
      orderBy: (products, { desc }) => [desc(products.createdAt)],
    });
  }),

  createVariant: publicProcedure
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

  updateVariantStock: publicProcedure
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
});
