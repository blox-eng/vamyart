import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../index";
import { db } from "../../client";
import { banners } from "../../schema";

type Banner = {
  id: string;
  text: string;
  isActive: boolean;
  scope: "global" | "page";
  pageSlug: string | null;
};

export function selectActiveBanner(all: Banner[], slug: string): Banner | null {
  const active = all.filter((b) => b.isActive);
  const scoped = active.find((b) => b.scope === "page" && b.pageSlug === slug);
  if (scoped) return scoped;
  return active.find((b) => b.scope === "global") ?? null;
}

export const bannersRouter = router({
  getActive: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const all = await db.query.banners.findMany();
      return selectActiveBanner(all, input.slug);
    }),

  list: protectedProcedure.query(async () => {
    return db.query.banners.findMany({
      orderBy: (b, { desc }) => [desc(b.createdAt)],
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        text: z.string().min(1),
        isActive: z.boolean().default(false),
        scope: z.enum(["global", "page"]).default("global"),
        pageSlug: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const [banner] = await db.insert(banners).values({
        text: input.text,
        isActive: input.isActive,
        scope: input.scope,
        pageSlug: input.pageSlug ?? null,
      }).returning();
      return banner;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        text: z.string().min(1).optional(),
        isActive: z.boolean().optional(),
        scope: z.enum(["global", "page"]).optional(),
        pageSlug: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...fields } = input;
      const [banner] = await db
        .update(banners)
        .set({ ...fields, updatedAt: new Date() })
        .where(eq(banners.id, id))
        .returning();
      if (!banner) throw new TRPCError({ code: "NOT_FOUND", message: "Banner not found" });
      return banner;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await db.delete(banners).where(eq(banners.id, input.id));
      return { success: true };
    }),
});
