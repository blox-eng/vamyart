import { z } from "zod";
import { eq, asc } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure } from "../index";
import { db } from "../../client";
import { artworkImages, artworks } from "../../schema";
import { TRPCError } from "@trpc/server";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "artwork-images";

// Bucket enforces these mime types and a 25MB file size limit server-side.
const CONTENT_TYPE_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const imageContentType = z.enum(["image/jpeg", "image/png", "image/webp"]);

// Derives a safe, lowercase storage extension from the (validated) content type.
// The client filename is never trusted for the storage key — it can carry unicode
// or unsafe characters that Supabase rejects with an opaque "Invalid key" error.
export function extForContentType(contentType: string): string {
  const ext = CONTENT_TYPE_EXT[contentType];
  if (!ext) throw new Error("Invalid file type");
  return ext;
}

function getStorageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars not set");
  return createClient(url, key);
}

export const artworkImagesRouter = router({
  list: publicProcedure
    .input(z.object({ artworkId: z.string().uuid() }))
    .query(async ({ input }) => {
      return db
        .select()
        .from(artworkImages)
        .where(eq(artworkImages.artworkId, input.artworkId))
        .orderBy(asc(artworkImages.sortOrder));
    }),

  // Step 1 of upload: mint a short-lived signed URL so the browser can PUT the
  // image bytes straight to Storage. This bypasses the serverless function's
  // request-body limit (~6MB on Netlify/Lambda) that the old base64-over-tRPC
  // approach hit — a large photo produced a non-JSON 413 that surfaced on Safari
  // as "The string did not match the expected pattern."
  createUploadUrl: protectedProcedure
    .input(z.object({ artworkId: z.string().uuid(), contentType: imageContentType }))
    .mutation(async ({ input }) => {
      const [artwork] = await db
        .select({ slug: artworks.slug })
        .from(artworks)
        .where(eq(artworks.id, input.artworkId));
      if (!artwork) throw new TRPCError({ code: "NOT_FOUND", message: "Artwork not found" });

      const path = `${artwork.slug}/${crypto.randomUUID()}.${extForContentType(input.contentType)}`;

      const supabase = getStorageClient();
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
      if (error || !data) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error?.message ?? "Could not create upload URL" });
      }
      return { path: data.path, token: data.token };
    }),

  // Step 2 of upload: record the object (already uploaded by the browser) in the DB.
  record: protectedProcedure
    .input(z.object({
      artworkId: z.string().uuid(),
      storagePath: z.string().min(1),
      altText: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const [artwork] = await db
        .select({ slug: artworks.slug })
        .from(artworks)
        .where(eq(artworks.id, input.artworkId));
      if (!artwork) throw new TRPCError({ code: "NOT_FOUND", message: "Artwork not found" });

      // The path must live under this artwork's folder — the client only ever
      // receives such a path from createUploadUrl above.
      if (!input.storagePath.startsWith(`${artwork.slug}/`)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid storage path" });
      }

      const existing = await db
        .select({ id: artworkImages.id })
        .from(artworkImages)
        .where(eq(artworkImages.artworkId, input.artworkId));

      const [row] = await db
        .insert(artworkImages)
        .values({
          artworkId: input.artworkId,
          storagePath: input.storagePath,
          altText: input.altText ?? null,
          isPrimary: existing.length === 0,
          sortOrder: existing.length,
        })
        .returning();

      return row;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const [image] = await db
        .select()
        .from(artworkImages)
        .where(eq(artworkImages.id, input.id));
      if (!image) throw new TRPCError({ code: "NOT_FOUND", message: "Image not found" });

      const supabase = getStorageClient();
      await supabase.storage.from(BUCKET).remove([image.storagePath]);

      await db.delete(artworkImages).where(eq(artworkImages.id, input.id));

      if (image.isPrimary) {
        const [next] = await db
          .select()
          .from(artworkImages)
          .where(eq(artworkImages.artworkId, image.artworkId))
          .orderBy(asc(artworkImages.sortOrder))
          .limit(1);
        if (next) {
          await db
            .update(artworkImages)
            .set({ isPrimary: true, updatedAt: new Date() })
            .where(eq(artworkImages.id, next.id));
        }
      }

      return { success: true };
    }),

  setPrimary: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const [image] = await db
        .select()
        .from(artworkImages)
        .where(eq(artworkImages.id, input.id));
      if (!image) throw new TRPCError({ code: "NOT_FOUND", message: "Image not found" });

      await db.transaction(async (tx) => {
        await tx
          .update(artworkImages)
          .set({ isPrimary: false, updatedAt: new Date() })
          .where(eq(artworkImages.artworkId, image.artworkId));
        await tx
          .update(artworkImages)
          .set({ isPrimary: true, updatedAt: new Date() })
          .where(eq(artworkImages.id, input.id));
      });

      return { success: true };
    }),
});
