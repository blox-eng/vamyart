import { z } from "zod";
import { eq, and, ne } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../index";
import { db } from "../../client";
import { collections, artworkCollections } from "../../schema";
import { slugify } from "./artworks";

const BUCKET = "artwork-images";

export function collectionCoverUrl(
  coverImagePath: string | null,
  fallbackStoragePath: string | null
): string | null {
  const path = coverImagePath ?? fallbackStoragePath;
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

export const collectionsRouter = router({
  // ── Protected CRUD ─────────────────────────────────────────────────────────
  list: protectedProcedure.query(async () => {
    return db.query.collections.findMany({
      where: (c, { isNull }) => isNull(c.deletedAt),
      orderBy: (c, { asc }) => [asc(c.sortOrder), asc(c.title)],
    });
  }),

  create: protectedProcedure
    .input(z.object({ title: z.string().min(1), description: z.string().optional() }))
    .mutation(async ({ input }) => {
      const [c] = await db
        .insert(collections)
        .values({ title: input.title, slug: slugify(input.title), description: input.description })
        .returning();
      return c;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).optional(),
        slug: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        coverImagePath: z.string().nullable().optional(),
        published: z.boolean().optional(),
        seoTitle: z.string().nullable().optional(),
        seoDescription: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...rest } = input;
      const [c] = await db
        .update(collections)
        .set({ ...rest, updatedAt: new Date() })
        .where(eq(collections.id, id))
        .returning();
      if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "Collection not found" });
      return c;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await db.delete(collections).where(eq(collections.id, input.id));
      return { id: input.id };
    }),

  reorder: protectedProcedure
    .input(z.object({ ids: z.array(z.string().uuid()) }))
    .mutation(async ({ input }) => {
      await db.transaction(async (tx) => {
        for (let i = 0; i < input.ids.length; i++) {
          await tx.update(collections).set({ sortOrder: i, updatedAt: new Date() }).where(eq(collections.id, input.ids[i]));
        }
      });
      return { ok: true };
    }),

  setFeatured: protectedProcedure
    .input(z.object({ id: z.string().uuid(), featured: z.boolean() }))
    .mutation(async ({ input }) => {
      return db.transaction(async (tx) => {
        if (input.featured) {
          await tx
            .update(collections)
            .set({ featured: false, updatedAt: new Date() })
            .where(and(eq(collections.featured, true), ne(collections.id, input.id)));
        }
        const [c] = await tx
          .update(collections)
          .set({ featured: input.featured, updatedAt: new Date() })
          .where(eq(collections.id, input.id))
          .returning();
        if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "Collection not found" });
        return c;
      });
    }),

  setPieces: protectedProcedure
    .input(z.object({ collectionId: z.string().uuid(), artworkIds: z.array(z.string().uuid()) }))
    .mutation(async ({ input }) => {
      await db.transaction(async (tx) => {
        await tx.delete(artworkCollections).where(eq(artworkCollections.collectionId, input.collectionId));
        if (input.artworkIds.length) {
          await tx.insert(artworkCollections).values(
            input.artworkIds.map((artworkId, i) => ({
              collectionId: input.collectionId,
              artworkId,
              sortOrder: i,
            }))
          );
        }
      });
      return { ok: true };
    }),

  getPieceIds: protectedProcedure
    .input(z.object({ collectionId: z.string().uuid() }))
    .query(async ({ input }) => {
      const rows = await db.query.artworkCollections.findMany({
        where: (ac, { eq }) => eq(ac.collectionId, input.collectionId),
        orderBy: (ac, { asc }) => [asc(ac.sortOrder)],
      });
      return rows.map((r) => r.artworkId);
    }),

  // ── Public reads ─────────────────────────────────────────────────────────────
  listPublic: publicProcedure.query(async () => {
    const rows = await db.query.collections.findMany({
      where: (c, { eq, and, isNull }) => and(eq(c.published, true), isNull(c.deletedAt)),
      orderBy: (c, { asc }) => [asc(c.sortOrder), asc(c.title)],
      with: {
        pieces: {
          orderBy: (ac, { asc }) => [asc(ac.sortOrder)],
          with: { artwork: { with: { images: { orderBy: (i, { asc }) => [asc(i.sortOrder)] } } } },
        },
      },
    });
    return rows.map((c) => {
      const first = c.pieces[0]?.artwork;
      const firstImg = first ? first.images.find((i) => i.isPrimary) ?? first.images[0] ?? null : null;
      return {
        id: c.id,
        slug: c.slug,
        title: c.title,
        description: c.description,
        pieceCount: c.pieces.length,
        coverUrl: collectionCoverUrl(c.coverImagePath, firstImg?.storagePath ?? null),
      };
    });
  }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ input }) => {
      const c = await db.query.collections.findFirst({
        where: (col, { eq }) => eq(col.slug, input.slug),
        with: {
          pieces: {
            orderBy: (ac, { asc }) => [asc(ac.sortOrder)],
            with: { artwork: { with: { images: { orderBy: (i, { asc }) => [asc(i.sortOrder)] } } } },
          },
        },
      });
      if (!c || !c.published || c.deletedAt) return null;
      const pieces = c.pieces
        .map((p) => p.artwork)
        .filter((a) => a.published && !a.deletedAt)
        .map((a) => {
          const primary = a.images.find((i) => i.isPrimary) ?? a.images[0] ?? null;
          return {
            slug: a.slug,
            title: a.title,
            excerpt: a.excerpt,
            primaryImage: primary
              ? { url: collectionCoverUrl(primary.storagePath, null), altText: primary.altText ?? a.title }
              : null,
          };
        });
      return {
        slug: c.slug,
        title: c.title,
        description: c.description,
        seoTitle: c.seoTitle,
        seoDescription: c.seoDescription,
        coverUrl: c.coverImagePath ? collectionCoverUrl(c.coverImagePath, null) : pieces[0]?.primaryImage?.url ?? null,
        pieces,
      };
    }),

  getFeatured: publicProcedure.query(async () => {
    const c = await db.query.collections.findFirst({
      where: (col, { eq, and, isNull }) => and(eq(col.featured, true), eq(col.published, true), isNull(col.deletedAt)),
      with: {
        pieces: {
          orderBy: (ac, { asc }) => [asc(ac.sortOrder)],
          with: { artwork: { with: { images: { orderBy: (i, { asc }) => [asc(i.sortOrder)] } } } },
        },
      },
    });
    if (!c) return null;
    const pieces = c.pieces
      .map((p) => p.artwork)
      .filter((a) => a.published && !a.deletedAt)
      .slice(0, 3)
      .map((a) => {
        const primary = a.images.find((i) => i.isPrimary) ?? a.images[0] ?? null;
        return { slug: a.slug, title: a.title, imageUrl: primary ? collectionCoverUrl(primary.storagePath, null) : null };
      });
    return {
      slug: c.slug,
      title: c.title,
      description: c.description,
      coverUrl: c.coverImagePath ? collectionCoverUrl(c.coverImagePath, null) : pieces[0]?.imageUrl ?? null,
      pieces,
    };
  }),
});
