import { z } from "zod";
import { eq, and, ne, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../index";
import { db } from "../../client";
import { artworks } from "../../schema";

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
      orderBy: (artworks, { asc }) => [asc(artworks.title)],
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
      const fields: Record<string, unknown> = { ...rest };
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
      return a;
    }),
});
