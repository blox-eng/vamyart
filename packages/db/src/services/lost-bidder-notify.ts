import { and, eq } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "../client";
import { auctions, bids } from "../schema";
import { upsertContact } from "./upsert-contact";

export interface NotifyLosersInput {
  auctionId: string;
  winningBidId: string;
}

export interface NotifyLosersResult {
  notified: number;
  skipped: number;
}

const formatEUR = (amount: string | number) =>
  new Intl.NumberFormat("en-EU", { style: "currency", currency: "EUR" }).format(Number(amount));

export async function notifyLostBidders(input: NotifyLosersInput): Promise<NotifyLosersResult> {
  const auction = await db.query.auctions.findFirst({
    where: eq(auctions.id, input.auctionId),
    with: { artwork: true },
  });
  if (!auction || !auction.artwork) return { notified: 0, skipped: 0 };

  const winningBid = await db.query.bids.findFirst({
    where: and(eq(bids.id, input.winningBidId), eq(bids.auctionId, input.auctionId)),
  });
  if (!winningBid) return { notified: 0, skipped: 0 };

  const winnerEmail = winningBid.bidderEmail.trim().toLowerCase();
  const winningPrice = formatEUR(winningBid.amount);
  const pieceTitle = auction.artwork.title;

  const allBids = await db.query.bids.findMany({
    where: eq(bids.auctionId, input.auctionId),
  });

  // Group by lowercased email, keep highest amount per bidder, exclude winner.
  const losersByEmail = new Map<string, number>();
  for (const b of allBids) {
    const email = b.bidderEmail.trim().toLowerCase();
    if (!email || email === winnerEmail) continue;
    const amount = Number(b.amount);
    const prev = losersByEmail.get(email) ?? -Infinity;
    if (amount > prev) losersByEmail.set(email, amount);
  }

  const losers = Array.from(losersByEmail.keys());

  if (!process.env.RESEND_API_KEY) {
    console.warn("[lost-bidder-notify] RESEND_API_KEY not set, skipping");
    return { notified: 0, skipped: losers.length };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM_EMAIL!;
  const subject = `Auction closed — ${pieceTitle}`;
  const text =
    `Thanks for bidding on ${pieceTitle}.\n\n` +
    `It went to another collector at ${winningPrice}.\n\n` +
    `I appreciate you showing up for this one — bidding is intimate, and not everyone does it. The next piece will land in the studio newsletter first.\n\n` +
    `— Maeve\nvamy.art`;

  let notified = 0;
  let skipped = 0;
  for (const email of losers) {
    try {
      const res = await resend.emails.send({ from, to: email, subject, text });
      if (res?.error) {
        console.error("[lost-bidder-notify] send failed", { email, err: res.error });
        skipped += 1;
        continue;
      }
      notified += 1;
      try {
        await upsertContact(db, { email });
      } catch (err) {
        console.error("[lost-bidder-notify] contact upsert failed", err);
      }
    } catch (err) {
      console.error("[lost-bidder-notify] send failed", { email, err });
      skipped += 1;
    }
  }

  return { notified, skipped };
}
