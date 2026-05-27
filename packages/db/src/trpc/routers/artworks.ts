import { z } from "zod";
import { eq, and, ne, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../index";
import { db } from "../../client";
import { artworks, products, productVariants, orders, auctions } from "../../schema";

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics (combining marks)
    .replace(/['‘’ʼ]/g, "") // strip apostrophes (straight, curly, modifier)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // non-alphanumerics -> hyphen
    .replace(/^-+|-+$/g, ""); // trim leading/trailing hyphens
}

// Returns a human-readable reason the artwork cannot be deleted, or null if deletable.
export function artworkDeleteBlockReason(input: {
  orderCount: number;
  auctionStatuses: string[];
}): string | null {
  if (input.orderCount > 0) {
    return "This piece has orders and cannot be deleted.";
  }
  if (input.auctionStatuses.includes("active")) {
    return "This piece has an active auction and cannot be deleted.";
  }
  return null;
}

const contentFields = {
  title: z.string().min(1),
  slug: z.string().min(1).optional(),
  year: z.number().int().nullable().optional(),
  medium: z.string().nullable().optional(),
  dimensions: z.string().nullable().optional(),
  status: z.enum(["available", "bidding", "sold"]).optional(),
  excerpt: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  featured: z.boolean().optional(),
  published: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  seoTitle: z.string().nullable().optional(),
  seoDescription: z.string().nullable().optional(),
};

// Throws CONFLICT if slug is taken by a different artwork.
async function assertSlugFree(slug: string, exceptId?: string) {
  const existing = await db
    .select({ id: artworks.id })
    .from(artworks)
    .where(exceptId ? and(eq(artworks.slug, slug), ne(artworks.id, exceptId)) : eq(artworks.slug, slug));
  if (existing.length > 0) {
    throw new TRPCError({ code: "CONFLICT", message: `Slug "${slug}" is already in use.` });
  }
}

export const artworksRouter = router({
  list: protectedProcedure.query(async () => {
    return db.query.artworks.findMany({
      where: (a, { isNull }) => isNull(a.deletedAt),
      orderBy: (artworks, { asc }) => [asc(artworks.sortOrder), asc(artworks.title)],
    });
  }),

  create: protectedProcedure
    .input(z.object(contentFields))
    .mutation(async ({ input }) => {
      const slug = slugify(input.slug ?? input.title);
      if (!slug) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Could not derive a slug from the title." });
      }
      await assertSlugFree(slug);
      const [a] = await db
        .insert(artworks)
        .values({
          slug,
          title: input.title,
          year: input.year ?? null,
          medium: input.medium ?? null,
          dimensions: input.dimensions ?? null,
          status: input.status ?? "available",
          excerpt: input.excerpt ?? null,
          description: input.description ?? null,
          featured: input.featured ?? false,
          published: input.published ?? false,
          sortOrder: input.sortOrder ?? 0,
          seoTitle: input.seoTitle ?? null,
          seoDescription: input.seoDescription ?? null,
        })
        .returning();
      return a;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string().uuid() }).extend(contentFields).partial({ title: true }))
    .mutation(async ({ input }) => {
      const { id, slug, ...rest } = input;
      const fields: Partial<typeof artworks.$inferInsert> = { ...rest };
      if (slug !== undefined) {
        const normalized = slugify(slug);
        if (!normalized) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Slug cannot be empty." });
        }
        await assertSlugFree(normalized, id);
        fields.slug = normalized;
      }
      const [a] = await db
        .update(artworks)
        .set({ ...fields, updatedAt: new Date() })
        .where(eq(artworks.id, id))
        .returning();
      if (!a) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Artwork not found" });
      }
      return a;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const productRows = await db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.artworkId, input.id));
      const productIds = productRows.map((p) => p.id);

      const variantRows = productIds.length
        ? await db
            .select({ id: productVariants.id })
            .from(productVariants)
            .where(inArray(productVariants.productId, productIds))
        : [];
      const variantIds = variantRows.map((v) => v.id);

      const orderRows = variantIds.length
        ? await db
            .select({ id: orders.id })
            .from(orders)
            .where(inArray(orders.productVariantId, variantIds))
        : [];

      const auctionRows = await db
        .select({ status: auctions.status })
        .from(auctions)
        .where(eq(auctions.artworkId, input.id));

      const blockReason = artworkDeleteBlockReason({
        orderCount: orderRows.length,
        auctionStatuses: auctionRows.map((a) => a.status),
      });
      if (blockReason) {
        throw new TRPCError({ code: "CONFLICT", message: blockReason });
      }

      const [a] = await db
        .update(artworks)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(artworks.id, input.id))
        .returning();
      if (!a) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Artwork not found" });
      }
      return { success: true };
    }),

  restore: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const [a] = await db
        .update(artworks)
        .set({ deletedAt: null, updatedAt: new Date() })
        .where(eq(artworks.id, input.id))
        .returning();
      if (!a) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Artwork not found" });
      }
      return a;
    }),

  listTrashed: protectedProcedure.query(async () => {
    return db.query.artworks.findMany({
      where: (a, { isNull, not }) => not(isNull(a.deletedAt)),
      orderBy: (a, { desc }) => [desc(a.deletedAt)],
    });
  }),

  reorder: protectedProcedure
    .input(z.object({ orderedIds: z.array(z.string().uuid()) }))
    .mutation(async ({ input }) => {
      await db.transaction(async (tx) => {
        for (let i = 0; i < input.orderedIds.length; i++) {
          await tx
            .update(artworks)
            .set({ sortOrder: i, updatedAt: new Date() })
            .where(eq(artworks.id, input.orderedIds[i]));
        }
      });
      return { success: true };
    }),

  setFeatured: protectedProcedure
    .input(z.object({ id: z.string().uuid(), featured: z.boolean() }))
    .mutation(async ({ input }) => {
      const [a] = await db
        .update(artworks)
        .set({ featured: input.featured, updatedAt: new Date() })
        .where(eq(artworks.id, input.id))
        .returning();
      if (!a) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Artwork not found" });
      }
      return a;
    }),

  listPublic: publicProcedure.query(async () => {
    const rows = await db.query.artworks.findMany({
      where: (a, { eq, and, isNull }) => and(eq(a.published, true), isNull(a.deletedAt)),
      orderBy: (a, { asc }) => [asc(a.sortOrder), asc(a.title)],
      with: {
        images: {
          orderBy: (img, { asc }) => [asc(img.sortOrder)],
        },
      },
    });
    return rows.map((a) => {
      const primary = a.images.find((img) => img.isPrimary) ?? a.images[0] ?? null;
      return {
        id: a.id,
        slug: a.slug,
        title: a.title,
        excerpt: a.excerpt,
        medium: a.medium,
        dimensions: a.dimensions,
        featured: a.featured,
        sortOrder: a.sortOrder,
        primaryImage: primary
          ? {
              url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/artwork-images/${primary.storagePath}`,
              altText: primary.altText ?? a.title,
            }
          : null,
      };
    });
  }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ input }) => {
      const a = await db.query.artworks.findFirst({
        where: (art, { eq }) => eq(art.slug, input.slug),
        with: {
          images: { orderBy: (img, { asc }) => [asc(img.sortOrder)] },
        },
      });
      if (!a || !a.published || a.deletedAt) return null;
      const primary = a.images.find((img) => img.isPrimary) ?? a.images[0] ?? null;
      return {
        id: a.id,
        slug: a.slug,
        title: a.title,
        year: a.year,
        medium: a.medium,
        dimensions: a.dimensions,
        status: a.status,
        published: a.published,
        excerpt: a.excerpt,
        description: a.description,
        seoTitle: a.seoTitle,
        seoDescription: a.seoDescription,
        primaryImage: primary
          ? {
              url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/artwork-images/${primary.storagePath}`,
              altText: primary.altText ?? a.title,
            }
          : null,
        images: a.images.map((img) => ({
          url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/artwork-images/${img.storagePath}`,
          altText: img.altText ?? a.title,
        })),
      };
    }),
});
