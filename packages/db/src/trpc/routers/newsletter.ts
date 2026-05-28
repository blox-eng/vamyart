import { z } from "zod";
import { router, publicProcedure } from "../index";
import { subscribeToButtondown } from "../../services/buttondown";

export const newsletterRouter = router({
  subscribe: publicProcedure
    .input(
      z.object({
        email: z.string().email().toLowerCase(),
        source: z.enum(["footer", "inquiry", "checkout", "bid"]).default("footer"),
        locale: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { alreadySubscribed } = await subscribeToButtondown(input);
      return { success: true, alreadySubscribed };
    }),
});
