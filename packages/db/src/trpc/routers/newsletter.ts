import { z } from "zod";
import { router, publicProcedure } from "../index";
import { db } from "../../client";
import { newsletterSubscribers } from "../../schema";

export const newsletterRouter = router({
  subscribe: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      // Store locally
      await db
        .insert(newsletterSubscribers)
        .values({ email: input.email })
        .onConflictDoNothing();

      // Sync to Buttondown
      const bdRes = await fetch("https://api.buttondown.email/v1/subscribers", {
        method: "POST",
        headers: {
          Authorization: `Token ${process.env.BUTTONDOWN_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email_address: input.email }),
      });

      if (!bdRes.ok) {
        // Don't throw — local record was saved. Log for ops visibility.
        console.error("[newsletter] Buttondown sync failed:", bdRes.status, await bdRes.text());
      }

      return { success: true };
    }),
});
