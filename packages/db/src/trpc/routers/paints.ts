import { z } from "zod";
import { asc, desc, eq } from "drizzle-orm";
import { router, protectedProcedure } from "../index";
import { db } from "../../client";
import { paints } from "../../schema";

export const paintsRouter = router({
  list: protectedProcedure.query(() =>
    db.select().from(paints).orderBy(desc(paints.owned), asc(paints.brand), asc(paints.name))
  ),

  setOwned: protectedProcedure
    .input(z.object({ id: z.string().uuid(), owned: z.boolean() }))
    .mutation(async ({ input }) => {
      await db.update(paints).set({ owned: input.owned }).where(eq(paints.id, input.id));
    }),

  // The accurate path: the artist photographs a swatch of their own tube and picks its colour.
  create: protectedProcedure
    .input(z.object({
      brand: z.string().trim().min(1).max(80),
      name: z.string().trim().min(1).max(80),
      pigments: z.array(z.string().trim().regex(/^P[A-Z]{1,2}\d+(:\d+)?$/)).max(4),
      hex: z.string().regex(/^#[0-9a-f]{6}$/),
    }))
    .mutation(async ({ input }) => {
      const [paint] = await db
        .insert(paints)
        .values({ ...input, owned: true, source: "Colour picked by the artist from a photographed swatch." })
        .onConflictDoUpdate({
          target: [paints.brand, paints.name, paints.medium],
          set: { hex: input.hex, pigments: input.pigments, owned: true, source: "Colour picked by the artist from a photographed swatch." },
        })
        .returning();
      return paint;
    }),
});
