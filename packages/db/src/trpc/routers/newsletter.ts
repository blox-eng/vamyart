import { z } from "zod";
import { router, publicProcedure } from "../index";
import { subscribeToButtondown } from "../../services/buttondown";
import { assertHuman } from "../human";

export const newsletterRouter = router({
  subscribe: publicProcedure
    .input(
      z.object({
        email: z.string().email().toLowerCase(),
        locale: z.string().optional(),
        turnstileToken: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await assertHuman(input.turnstileToken, ctx.clientIp);
      const { alreadySubscribed } = await subscribeToButtondown({
        email: input.email,
        source: "footer",
        locale: input.locale,
        ipAddress: ctx.clientIp,
      });
      return { success: true, alreadySubscribed };
    }),
});
