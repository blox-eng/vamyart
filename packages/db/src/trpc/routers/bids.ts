import { z } from "zod";
import { eq, desc, sql } from "drizzle-orm";
import { router, publicProcedure } from "../index";
import { db } from "../../client";
import { bids, auctions } from "../../schema";
import { Resend } from "resend";
import { escapeHtml } from "../../utils/escape-html";

export function validateBid({
  amount,
  currentBid,
  minBid,
  minIncrement,
  deadline,
}: {
  amount: number;
  currentBid: number | null;
  minBid: number;
  minIncrement: number;
  deadline: Date;
}): { valid: true } | { valid: false; reason: string } {
  if (new Date() > deadline) {
    return { valid: false, reason: "Auction has ended" };
  }
  const floor = currentBid !== null ? currentBid + minIncrement : minBid;
  if (amount < floor) {
    return { valid: false, reason: `Bid must be at least €${floor}` };
  }
  return { valid: true };
}

export const bidsRouter = router({
  place: publicProcedure
    .input(
      z.object({
        auctionId: z.string().uuid(),
        bidderName: z.string().min(1),
        bidderEmail: z.string().email(),
        amount: z.number().positive(),
        ipAddress: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const auction = await db.query.auctions.findFirst({
        where: eq(auctions.id, input.auctionId),
      });

      if (!auction || auction.status !== "active") {
        throw new Error("Auction not found or not active");
      }

      const validation = validateBid({
        amount: input.amount,
        currentBid: auction.currentBid ? Number(auction.currentBid) : null,
        minBid: Number(auction.minBid),
        minIncrement: Number(auction.minIncrement),
        deadline: auction.deadline,
      });

      if (!validation.valid) {
        throw new Error(validation.reason);
      }

      // Get previous highest bidder before inserting
      const previousTopBid = await db.query.bids.findFirst({
        where: eq(bids.auctionId, input.auctionId),
        orderBy: [desc(bids.amount)],
      });

      // Atomic update
      const [newBid] = await db.transaction(async (tx) => {
        const inserted = await tx
          .insert(bids)
          .values({
            auctionId: input.auctionId,
            bidderName: input.bidderName,
            bidderEmail: input.bidderEmail,
            amount: String(input.amount),
            ipAddress: input.ipAddress,
          })
          .returning();

        await tx
          .update(auctions)
          .set({
            currentBid: String(input.amount),
            bidCount: sql`bid_count + 1`,
            updatedAt: new Date(),
          })
          .where(eq(auctions.id, input.auctionId));

        return inserted;
      });

      const resend = new Resend(process.env.RESEND_API_KEY);

      // Email: outbid alert to previous highest bidder
      if (previousTopBid && previousTopBid.bidderEmail !== input.bidderEmail) {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL!,
          to: previousTopBid.bidderEmail,
          subject: "You've been outbid",
          html: `<p>Your bid has been surpassed. Current bid is now €${input.amount}. <a href="${process.env.NEXT_PUBLIC_SITE_URL}/get-a-piece">Place a new bid</a>.</p>`,
        });
      }

      // Email: notify artist
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL!,
        to: process.env.RESEND_ARTIST_EMAIL!,
        subject: `New bid: €${input.amount}`,
        html: `<p><strong>${escapeHtml(input.bidderName)}</strong> bid €${input.amount}. Total bids: ${auction.bidCount + 1}.</p>`,
      });

      return { success: true, bidId: newBid.id };
    }),

  listByAuction: publicProcedure
    .input(z.object({ auctionId: z.string().uuid() }))
    .query(async ({ input }) => {
      return db.query.bids.findMany({
        where: eq(bids.auctionId, input.auctionId),
        orderBy: [desc(bids.amount)],
      });
    }),
});
