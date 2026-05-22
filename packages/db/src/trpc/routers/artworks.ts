import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, protectedProcedure } from "../index";
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

export const artworksRouter = router({
  list: protectedProcedure.query(async () => {
    return db.query.artworks.findMany({
      orderBy: (artworks, { asc }) => [asc(artworks.title)],
    });
  }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).optional(),
        medium: z.string().optional(),
        dimensions: z.string().optional(),
        year: z.number().int().optional(),
        status: z.enum(["available", "bidding", "sold"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...fields } = input;
      const [a] = await db
        .update(artworks)
        .set({ ...fields, updatedAt: new Date() })
        .where(eq(artworks.id, id))
        .returning();
      return a;
    }),
});
