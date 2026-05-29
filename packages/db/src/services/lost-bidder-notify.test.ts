import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { inArray, eq } from "drizzle-orm";
import { db } from "../client";
import { artworks, auctions, bids, contacts } from "../schema";
import { notifyLostBidders } from "./lost-bidder-notify";

const artworkIds: string[] = [];
const auctionIds: string[] = [];
const bidIds: string[] = [];
const emails: string[] = [];

afterAll(async () => {
  if (bidIds.length) await db.delete(bids).where(inArray(bids.id, bidIds));
  if (auctionIds.length) await db.delete(auctions).where(inArray(auctions.id, auctionIds));
  if (artworkIds.length) await db.delete(artworks).where(inArray(artworks.id, artworkIds));
  if (emails.length) await db.delete(contacts).where(inArray(contacts.email, emails));
});

beforeEach(() => {
  vi.restoreAllMocks();
  process.env.RESEND_API_KEY = "test-key";
  process.env.RESEND_FROM_EMAIL = "studio@vamy.art";
});

type Seeded = {
  auctionId: string;
  winnerBidId: string;
  loserEmails: string[];
};

async function seedAuction(opts: {
  losers: Array<{ email: string; amount: number; extra?: number }>;
  winnerEmail: string;
  winnerAmount: number;
  title?: string;
}): Promise<Seeded> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [artwork] = await db
    .insert(artworks)
    .values({ slug: `lbn-${suffix}`, title: opts.title ?? `Lost Bidder Piece ${suffix}` })
    .returning();
  artworkIds.push(artwork!.id);

  const [auction] = await db
    .insert(auctions)
    .values({
      artworkId: artwork!.id,
      minBid: "100",
      deadline: new Date(Date.now() + 86400_000),
    })
    .returning();
  auctionIds.push(auction!.id);

  // Insert loser bids first
  for (const l of opts.losers) {
    emails.push(l.email.toLowerCase());
    const [b1] = await db
      .insert(bids)
      .values({
        auctionId: auction!.id,
        bidderName: l.email.split("@")[0]!,
        bidderEmail: l.email,
        amount: String(l.amount),
      })
      .returning();
    bidIds.push(b1!.id);
    if (l.extra !== undefined) {
      const [b2] = await db
        .insert(bids)
        .values({
          auctionId: auction!.id,
          bidderName: l.email.split("@")[0]!,
          bidderEmail: l.email,
          amount: String(l.extra),
        })
        .returning();
      bidIds.push(b2!.id);
    }
  }

  emails.push(opts.winnerEmail.toLowerCase());
  const [winnerBid] = await db
    .insert(bids)
    .values({
      auctionId: auction!.id,
      bidderName: opts.winnerEmail.split("@")[0]!,
      bidderEmail: opts.winnerEmail,
      amount: String(opts.winnerAmount),
    })
    .returning();
  bidIds.push(winnerBid!.id);

  await db
    .update(auctions)
    .set({ winnerBidId: winnerBid!.id, currentBid: String(opts.winnerAmount) })
    .where(eq(auctions.id, auction!.id));

  return {
    auctionId: auction!.id,
    winnerBidId: winnerBid!.id,
    loserEmails: opts.losers.map((l) => l.email.toLowerCase()),
  };
}

function mockResendOk() {
  return vi.spyOn(globalThis, "fetch").mockImplementation(
    async () =>
      new Response(JSON.stringify({ id: "email_1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  );
}

describe("notifyLostBidders", () => {
  it("emails each unique losing bidder once with the winning price", async () => {
    const suffix = Date.now();
    const seeded = await seedAuction({
      title: "Sunset Over Cobalt",
      losers: [
        { email: `loser1-${suffix}@example.com`, amount: 200 },
        { email: `loser2-${suffix}@example.com`, amount: 250 },
        { email: `loser3-${suffix}@example.com`, amount: 300 },
      ],
      winnerEmail: `winner-${suffix}@example.com`,
      winnerAmount: 500,
    });

    const fetchMock = mockResendOk();
    const result = await notifyLostBidders({
      auctionId: seeded.auctionId,
      winningBidId: seeded.winnerBidId,
    });

    const resendCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes("api.resend.com"),
    );
    expect(resendCalls).toHaveLength(3);
    expect(result.notified).toBe(3);
    expect(result.skipped).toBe(0);

    const recipients = new Set<string>();
    for (const [, init] of resendCalls) {
      const body = JSON.parse((init as RequestInit).body as string);
      const to = Array.isArray(body.to) ? body.to[0] : body.to;
      recipients.add(to);
      expect(body.text).toContain("Sunset Over Cobalt");
      expect(body.text).toContain("€500");
      expect(body.subject).toBe("Auction closed — Sunset Over Cobalt");
    }
    for (const e of seeded.loserEmails) expect(recipients.has(e)).toBe(true);
  });

  it("dedupes a bidder who placed multiple losing bids", async () => {
    const suffix = Date.now() + 1;
    const repeatEmail = `repeat-${suffix}@example.com`;
    const seeded = await seedAuction({
      losers: [{ email: repeatEmail, amount: 150, extra: 220 }],
      winnerEmail: `winner-${suffix}@example.com`,
      winnerAmount: 400,
    });

    const fetchMock = mockResendOk();
    const result = await notifyLostBidders({
      auctionId: seeded.auctionId,
      winningBidId: seeded.winnerBidId,
    });

    const resendCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes("api.resend.com"),
    );
    expect(resendCalls).toHaveLength(1);
    expect(result.notified).toBe(1);
    const body = JSON.parse((resendCalls[0]![1] as RequestInit).body as string);
    const to = Array.isArray(body.to) ? body.to[0] : body.to;
    expect(to).toBe(repeatEmail.toLowerCase());
  });

  it("returns skipped count with no sends when RESEND_API_KEY is unset", async () => {
    delete process.env.RESEND_API_KEY;
    const suffix = Date.now() + 2;
    const seeded = await seedAuction({
      losers: [
        { email: `nokey1-${suffix}@example.com`, amount: 200 },
        { email: `nokey2-${suffix}@example.com`, amount: 300 },
      ],
      winnerEmail: `winner-${suffix}@example.com`,
      winnerAmount: 500,
    });

    const fetchMock = vi.spyOn(globalThis, "fetch");
    const result = await notifyLostBidders({
      auctionId: seeded.auctionId,
      winningBidId: seeded.winnerBidId,
    });

    expect(result).toEqual({ notified: 0, skipped: 2 });
    const resendCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes("api.resend.com"),
    );
    expect(resendCalls).toHaveLength(0);
  });

  it("still notifies remaining losers when one send fails", async () => {
    const suffix = Date.now() + 3;
    const failingEmail = `fail-${suffix}@example.com`;
    const seeded = await seedAuction({
      losers: [
        { email: failingEmail, amount: 200 },
        { email: `ok1-${suffix}@example.com`, amount: 250 },
        { email: `ok2-${suffix}@example.com`, amount: 300 },
      ],
      winnerEmail: `winner-${suffix}@example.com`,
      winnerAmount: 500,
    });

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      const u = String(url);
      if (u.includes("api.resend.com")) {
        const body = JSON.parse((init as RequestInit).body as string);
        const to = Array.isArray(body.to) ? body.to[0] : body.to;
        if (to === failingEmail.toLowerCase()) {
          return new Response(JSON.stringify({ message: "boom" }), { status: 500 });
        }
        return new Response(JSON.stringify({ id: "email_ok" }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });

    const result = await notifyLostBidders({
      auctionId: seeded.auctionId,
      winningBidId: seeded.winnerBidId,
    });

    const resendCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes("api.resend.com"),
    );
    expect(resendCalls).toHaveLength(3);
    expect(result.notified).toBe(2);
    expect(result.skipped).toBe(1);
  });
});
