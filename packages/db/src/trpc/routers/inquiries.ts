import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure } from "../index";
import { db } from "../../client";
import { inquiries } from "../../schema";
import { Resend } from "resend";
import { escapeHtml } from "../../utils/escape-html";

export const inquiriesRouter = router({
  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        pieceInterest: z.string().min(1),
        message: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await db.insert(inquiries).values(input);

      // Notify artist
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL!,
        to: process.env.RESEND_ARTIST_EMAIL!,
        subject: `New inquiry: ${input.pieceInterest}`,
        html: `
          <p><strong>${escapeHtml(input.name)}</strong> (${escapeHtml(input.email)}) is interested in <em>${escapeHtml(input.pieceInterest)}</em>.</p>
          ${input.message ? `<p>${escapeHtml(input.message)}</p>` : ""}
        `,
      });

      // Auto-reply to collector
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL!,
        to: input.email,
        subject: "We received your inquiry",
        html: `<p>Hi ${escapeHtml(input.name)}, thank you for reaching out. We'll be in touch soon.</p>`,
      });

      return { success: true };
    }),

  list: protectedProcedure.query(async () => {
    return db.query.inquiries.findMany({
      orderBy: (inquiries, { desc }) => [desc(inquiries.createdAt)],
    });
  }),

  markHandled: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await db
        .update(inquiries)
        .set({ handledAt: new Date() })
        .where(eq(inquiries.id, input.id));
      return { success: true };
    }),
});
