import { z } from "zod";
import { eq, asc } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure } from "../index";
import { db } from "../../client";
import { artworkImages, artworks } from "../../schema";
import { TRPCError } from "@trpc/server";
import { createClient } from "@supabase/supabase-js";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

function getStorageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars not set");
  return createClient(url, key);
}

export function validateImageInput(input: { fileBase64: string; fileName: string; artworkId: string }) {
  const mimeMatch = input.fileBase64.match(/^data:(image\/\w+);base64,/);
  if (!mimeMatch) throw new Error("Invalid file format");
  const mimeType = mimeMatch[1];
  if (!ALLOWED_TYPES.includes(mimeType)) throw new Error("Invalid file type");

  const base64Data = input.fileBase64.replace(/^data:image\/\w+;base64,/, "");
  const sizeBytes = Math.ceil(base64Data.length * 0.75);
  if (sizeBytes > MAX_SIZE_BYTES) throw new Error("File too large");

  return { mimeType, base64Data };
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

  upload: protectedProcedure
    .input(z.object({
      artworkId: z.string().uuid(),
      fileBase64: z.string(),
      fileName: z.string(),
      altText: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { mimeType, base64Data } = validateImageInput(input);

      const [artwork] = await db
        .select({ slug: artworks.slug })
        .from(artworks)
        .where(eq(artworks.id, input.artworkId));
      if (!artwork) throw new TRPCError({ code: "NOT_FOUND", message: "Artwork not found" });

      const existing = await db
        .select({ id: artworkImages.id })
        .from(artworkImages)
        .where(eq(artworkImages.artworkId, input.artworkId));
      const isFirst = existing.length === 0;

      const ext = input.fileName.split(".").pop() || "jpg";
      const storagePath = `${artwork.slug}/${crypto.randomUUID()}.${ext}`;
      const buffer = Buffer.from(base64Data, "base64");

      const supabase = getStorageClient();
      const { error: uploadError } = await supabase.storage
        .from("artwork-images")
        .upload(storagePath, buffer, { contentType: mimeType, upsert: false });
      if (uploadError) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: uploadError.message });

      const [row] = await db
        .insert(artworkImages)
        .values({
          artworkId: input.artworkId,
          storagePath,
          altText: input.altText ?? null,
          isPrimary: isFirst,
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
      await supabase.storage.from("artwork-images").remove([image.storagePath]);

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
