import { z } from "zod";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../index";
import { db } from "../../client";
import { artworks, critiqueRuns } from "../../schema";
import { getStorageClient } from "../../services/storage";
import { CRITIQUE_BUCKET, CRITIQUE_MODELS, runCritique, STALE_RUN_MS } from "../../services/critique-run";
import { extForContentType } from "./artworkImages";
import { MAP, PLACES } from "@vamy/palette";

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

const share = z.number().min(0).max(1);
const place = z.enum(PLACES as [string, ...string[]]);
export const measurementsSchema = z.object({
  value: z.object({
    mean: share,
    low: share,
    high: share,
    shares: z.tuple([share, share, share]),
    grid: z.array(z.array(z.number().int().min(0).max(100)).length(MAP)).length(MAP),
    contrastAt: place,
  }),
  chroma: z.object({ mean: z.number().min(0).max(0.5), neutralShare: share, strongestAt: place.nullable() }),
  temperature: z.object({
    warmShare: share.nullable(),
    warmestAt: place.nullable(),
    coolestAt: place.nullable(),
    lightsVsDarks: z.enum(["warmer", "cooler", "same"]),
  }),
});

const DISPATCH_TIMEOUT_MS = 10_000;
const ACTIVE = ["queued", "running"];

const isStale = (run: { status: string; updatedAt: Date }) =>
  ACTIVE.includes(run.status) && Date.now() - run.updatedAt.getTime() > STALE_RUN_MS;

async function failRun(runId: string, error: string): Promise<never> {
  await db.update(critiqueRuns).set({ status: "failed", error, updatedAt: new Date() }).where(eq(critiqueRuns.id, runId));
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error });
}

// Background function on Netlify (a run outlives a normal request); inline only in
// local dev, because a deployed request is frozen once it responds.
// The function's address comes from Netlify's own deploy URL, never from the request,
// so a forged Host header can't redirect the bearer secret. DEPLOY_PRIME_URL is this
// deploy's own address, so a preview runs its own function, not production's.
async function dispatch(runId: string) {
  const secret = process.env.CRITIQUE_FN_SECRET;
  const base = process.env.DEPLOY_PRIME_URL || process.env.URL;
  if (!secret || !base) {
    if (process.env.NODE_ENV === "production") {
      return failRun(runId, "The critique function is not configured (CRITIQUE_FN_SECRET or the site URL is missing).");
    }
    void runCritique(runId);
    return;
  }
  let status: number;
  try {
    const res = await fetch(`${base}/.netlify/functions/critique-run-background`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({ runId }),
      redirect: "manual",
      signal: AbortSignal.timeout(DISPATCH_TIMEOUT_MS),
    });
    status = res.status;
  } catch (err) {
    return failRun(runId, `Could not start critique: ${err instanceof Error ? err.message : String(err)}`);
  }
  // A background function answers 202 as soon as it is invoked; anything else
  // (a redirect to the login page, a 404 on a deploy without it) means it never ran.
  if (status !== 202) return failRun(runId, `Could not start critique (${status})`);
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
      measurements: measurementsSchema.nullable(),
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
          measurements: input.measurements,
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
      let [run] = await db.select().from(critiqueRuns).where(eq(critiqueRuns.id, input.id));
      if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Critique not found" });
      if (isStale(run)) {
        // Guarded so a run that finished meanwhile keeps its result.
        const [failed] = await db
          .update(critiqueRuns)
          .set({ status: "failed", error: "The critique stopped before finishing. Run it again.", updatedAt: new Date() })
          .where(and(
            eq(critiqueRuns.id, run.id),
            inArray(critiqueRuns.status, ACTIVE),
            lt(critiqueRuns.updatedAt, new Date(Date.now() - STALE_RUN_MS)),
          ))
          .returning();
        [run] = failed ? [failed] : await db.select().from(critiqueRuns).where(eq(critiqueRuns.id, input.id));
      }
      const { data } = await getStorageClient().storage.from(CRITIQUE_BUCKET).createSignedUrl(run.storagePath, 3600);
      return { ...run, imageUrl: data?.signedUrl ?? null };
    }),

  list: protectedProcedure.query(async () => {
    const runs = await db
      .select({
        id: critiqueRuns.id,
        prompt: critiqueRuns.prompt,
        status: critiqueRuns.status,
        palette: critiqueRuns.palette,
        createdAt: critiqueRuns.createdAt,
        updatedAt: critiqueRuns.updatedAt,
      })
      .from(critiqueRuns)
      .orderBy(desc(critiqueRuns.createdAt))
      .limit(30);
    return runs.map((r) => (isStale(r) ? { ...r, status: "failed" } : r));
  }),

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
