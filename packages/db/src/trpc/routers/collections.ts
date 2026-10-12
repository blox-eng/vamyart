import { z } from "zod";
import { eq, and, ne, sql, isNull, asc, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createClient } from "@supabase/supabase-js";
import { router, protectedProcedure } from "../index";
import { db } from "../../client";
import { collections, artworkCollections, artworks } from "../../schema";
import { slugify } from "./artworks";
import { extForContentType } from "./artworkImages";

const BUCKET = "artwork-images";

const imageContentType = z.enum(["image/jpeg", "image/png", "image/webp"]);

// Throws CONFLICT if slug is taken by a different collection.
async function assertSlugFree(slug: string, exceptId?: string) {
  const existing = await db
    .select({ id: collections.id })
    .from(collections)
    .where(exceptId ? and(eq(collections.slug, slug), ne(collections.id, exceptId)) : eq(collections.slug, slug));
  if (existing.length > 0) {
    throw new TRPCError({ code: "CONFLICT", message: `Slug "${slug}" is already in use.` });
  }
}

function getStorageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars not set");
  return createClient(url, key);
}

export function collectionCoverUrl(
  coverImagePath: string | null,
  fallbackStoragePath: string | null
): string | null {
  const path = coverImagePath ?? fallbackStoragePath;
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/${BUCKET}/${path}`;
}

export const collectionsRouter = router({
  // ── Protected CRUD ─────────────────────────────────────────────────────────
  list: protectedProcedure.query(async () => {
    return db.query.collections.findMany({
      where: (c, { isNull }) => isNull(c.deletedAt),
      orderBy: (c, { asc }) => [asc(c.sortOrder), asc(c.title)],
      extras: () => ({
        // Literal on purpose: relational extras render ${collections.id} unqualified, which binds to the inner table.
        pieceCount: sql<number>`(select count(*)::int from ${artworkCollections} ac join ${artworks} a on a.id = ac.artwork_id where ac.collection_id = "collections"."id" and a.deleted_at is null)`.as("piece_count"),
      }),
    });
  }),

  create: protectedProcedure
    .input(z.object({ title: z.string().trim().min(1), description: z.string().optional() }))
    .mutation(async ({ input }) => {
      const slug = slugify(input.title);
      if (!slug) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Could not derive a slug from the title." });
      }
      await assertSlugFree(slug);
      const [c] = await db
        .insert(collections)
        .values({ title: input.title, slug, description: input.description })
        .returning();
      return c;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().trim().min(1).optional(),
        slug: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        coverImagePath: z.string().nullable().optional(),
        published: z.boolean().optional(),
        onLanding: z.boolean().optional(),
        seoTitle: z.string().nullable().optional(),
        seoDescription: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, slug, ...rest } = input;
      let normalizedSlug: string | undefined;
      if (slug !== undefined) {
        normalizedSlug = slugify(slug);
        if (!normalizedSlug) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Slug cannot be empty." });
        }
        await assertSlugFree(normalizedSlug, id);
      }
      const [c] = await db
        .update(collections)
        .set({ ...rest, ...(normalizedSlug !== undefined ? { slug: normalizedSlug } : {}), updatedAt: new Date() })
        .where(eq(collections.id, id))
        .returning();
      if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "Collection not found" });
      return c;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      // Soft-delete: the read paths already filter isNull(deletedAt), so this
      // hides the collection everywhere while keeping its piece assignments
      // recoverable (the ON DELETE CASCADE on artwork_collections only fires on
      // a hard delete).
      await db
        .update(collections)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(collections.id, input.id));
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

  setPieces: protectedProcedure
    .input(z.object({ collectionId: z.string().uuid(), artworkIds: z.array(z.string().uuid()) }))
    .mutation(async ({ input }) => {
      if (new Set(input.artworkIds).size !== input.artworkIds.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Duplicate artwork ids in collection." });
      }
      await db.transaction(async (tx) => {
        // Only live pieces are replaced; soft-deleted pieces keep their membership so restore brings them back.
        await tx.delete(artworkCollections).where(
          and(
            eq(artworkCollections.collectionId, input.collectionId),
            inArray(artworkCollections.artworkId, tx.select({ id: artworks.id }).from(artworks).where(isNull(artworks.deletedAt)))
          )
        );
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
      const rows = await db
        .select({ artworkId: artworkCollections.artworkId })
        .from(artworkCollections)
        .innerJoin(artworks, eq(artworks.id, artworkCollections.artworkId))
        .where(and(eq(artworkCollections.collectionId, input.collectionId), isNull(artworks.deletedAt)))
        .orderBy(asc(artworkCollections.sortOrder));
      return rows.map((r) => r.artworkId);
    }),

  // Step 1 of the cover-image upload: mint a short-lived signed URL so the
  // browser can PUT the image bytes straight to Storage, mirroring
  // artworkImages.createUploadUrl (bypasses the serverless function's
  // request-body limit). The collection's own row doesn't need to exist yet
  // in Storage — we just namespace by collection id to avoid collisions.
  createCoverUploadUrl: protectedProcedure
    .input(z.object({ collectionId: z.string().uuid(), contentType: imageContentType }))
    .mutation(async ({ input }) => {
      const [collection] = await db
        .select({ id: collections.id })
        .from(collections)
        .where(eq(collections.id, input.collectionId));
      if (!collection) throw new TRPCError({ code: "NOT_FOUND", message: "Collection not found" });

      const path = `collections/${input.collectionId}/${crypto.randomUUID()}.${extForContentType(input.contentType)}`;

      const supabase = getStorageClient();
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
      if (error || !data) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error?.message ?? "Could not create upload URL" });
      }
      return { path: data.path, token: data.token };
    }),
});
