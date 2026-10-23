import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../index";
import { db } from "../../client";
import { artworks, critiqueRuns } from "../../schema";
import { getStorageClient } from "../../services/storage";
import { CRITIQUE_BUCKET, CRITIQUE_MODELS, runCritique } from "../../services/critique-run";
import { extForContentType } from "./artworkImages";

const hex = z.string().regex(/^#[0-9a-f]{6}$/);

const recipeSchema = z.object({
  hex,
  deltaE: z.number().nonnegative(),
  parts: z.array(z.object({
    paintId: z.string(),
    name: z.string(),
    pigments: z.array(z.string()),
    parts: z.number().int().positive(),
  })).min(1).max(3),
});

const paletteSchema = z.object({
  swatches: z.array(z.object({
    hex,
    name: z.string().max(80),
    area: z.number().min(0).max(1),
    recipe: recipeSchema.nullable(),
  })).min(1).max(12),
});

// Background function on Netlify (a run outlives a normal request); inline in local dev.
// The function's address comes from Netlify's own site URL, never from the request,
// so a forged Host header can't redirect the bearer secret.
async function dispatch(runId: string) {
  const secret = process.env.CRITIQUE_FN_SECRET;
  const base = process.env.URL;
  if (!secret || !base) {
    void runCritique(runId);
    return;
  }
  const res = await fetch(`${base}/.netlify/functions/critique-run-background`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ runId }),
  });
  if (!res.ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Could not start critique (${res.status})` });
}

export const critiqueRouter = router({
  createUploadUrl: protectedProcedure
    .input(z.object({ contentType: z.enum(["image/jpeg", "image/png", "image/webp"]) }))
    .mutation(async ({ input }) => {
      const path = `${crypto.randomUUID()}.${extForContentType(input.contentType)}`;
      const { data, error } = await getStorageClient().storage.from(CRITIQUE_BUCKET).createSignedUploadUrl(path);
      if (error || !data) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error?.message ?? "Could not create upload URL" });
      }
      return { path: data.path, token: data.token };
    }),

  create: protectedProcedure
    .input(z.object({
      storagePath: z.string().regex(/^[0-9a-f-]{36}\.(jpg|png|webp)$/),
      prompt: z.string().trim().max(2000).nullable(),
      whiteBalance: z.tuple([z.number(), z.number(), z.number()]).nullable(),
      swatches: z.array(z.object({ hex, area: z.number().min(0).max(1) })).min(1).max(12),
      artworkId: z.string().uuid().nullable(),
      model: z.enum(CRITIQUE_MODELS).nullable(),
    }))
    .mutation(async ({ input }) => {
      const [run] = await db
        .insert(critiqueRuns)
        .values({
          storagePath: input.storagePath,
          prompt: input.prompt || null,
          whiteBalance: input.whiteBalance,
          artworkId: input.artworkId,
          model: input.model,
          palette: { swatches: input.swatches.map((s) => ({ ...s, name: "", recipe: null })) },
        })
        .returning({ id: critiqueRuns.id });
      await dispatch(run.id);
      return run;
    }),

  models: protectedProcedure.query(() => ({ models: CRITIQUE_MODELS, default: process.env.CRITIQUE_MODEL || CRITIQUE_MODELS[0] })),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const [run] = await db.select().from(critiqueRuns).where(eq(critiqueRuns.id, input.id));
      if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Critique not found" });
      const { data } = await getStorageClient().storage.from(CRITIQUE_BUCKET).createSignedUrl(run.storagePath, 3600);
      return { ...run, imageUrl: data?.signedUrl ?? null };
    }),

  list: protectedProcedure.query(() =>
    db
      .select({
        id: critiqueRuns.id,
        prompt: critiqueRuns.prompt,
        status: critiqueRuns.status,
        palette: critiqueRuns.palette,
        createdAt: critiqueRuns.createdAt,
      })
      .from(critiqueRuns)
      .orderBy(desc(critiqueRuns.createdAt))
      .limit(30)
  ),

  savePalette: protectedProcedure
    .input(z.object({ artworkId: z.string().uuid(), palette: paletteSchema, showPalette: z.boolean() }))
    .mutation(async ({ input }) => {
      const [a] = await db
        .update(artworks)
        .set({ palette: input.palette, showPalette: input.showPalette, updatedAt: new Date() })
        .where(eq(artworks.id, input.artworkId))
        .returning({ slug: artworks.slug });
      if (!a) throw new TRPCError({ code: "NOT_FOUND", message: "Artwork not found" });
      return a;
    }),
});
