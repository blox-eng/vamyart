import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, protectedProcedure } from "../index";
import { db } from "../../client";
import { artworks } from "../../schema";

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
