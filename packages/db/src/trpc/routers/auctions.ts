import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, publicProcedure } from "../index";
import { db } from "../../client";
import { auctions, artworks } from "../../schema";

export const auctionsRouter = router({
  getByArtworkSlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const artwork = await db.query.artworks.findFirst({
        where: eq(artworks.slug, input.slug),
      });
      if (!artwork) return null;

      return db.query.auctions.findFirst({
        where: eq(auctions.artworkId, artwork.id),
      });
    }),

  list: publicProcedure.query(async () => {
    return db.query.auctions.findMany({
      with: { artwork: true },
      orderBy: (auctions, { desc }) => [desc(auctions.createdAt)],
    });
  }),

  open: publicProcedure
    .input(
      z.object({
        artworkId: z.string().uuid(),
        minBid: z.number().positive(),
        minIncrement: z.number().positive().default(100),
        deadline: z.string().datetime(),
      })
    )
    .mutation(async ({ input }) => {
      const [auction] = await db
        .insert(auctions)
        .values({
          artworkId: input.artworkId,
          minBid: String(input.minBid),
          minIncrement: String(input.minIncrement),
          deadline: new Date(input.deadline),
        })
        .returning();

      await db
        .update(artworks)
        .set({ status: "bidding", updatedAt: new Date() })
        .where(eq(artworks.id, input.artworkId));

      return auction;
    }),

  close: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        winnerBidId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await db
        .update(auctions)
        .set({
          status: "closed",
          winnerBidId: input.winnerBidId,
          updatedAt: new Date(),
        })
        .where(eq(auctions.id, input.id));
      return { success: true };
    }),
});
