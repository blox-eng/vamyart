import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { createCaller } from "../root";
import { db } from "../../client";
import { contacts, inquiries, bids, auctions, artworks } from "../../schema";

const ctx = { db, userId: "test-admin" } as const;

const email = `crm-${Date.now()}-${Math.random()}@example.com`;
let artworkId: string;
let auctionId: string;

beforeAll(async () => {
  const caller = createCaller(ctx);
  await caller.inquiries.create({
    name: "Timeline Tester",
    email,
    pieceInterest: "Aurora",
    message: "interested",
  });
  const [aw] = await db.insert(artworks).values({ slug: `crm-${Date.now()}-${Math.random()}`, title: "Aurora" }).returning();
  artworkId = aw.id;
  const [auc] = await db
    .insert(auctions)
    .values({ artworkId: aw.id, minBid: "100", deadline: new Date(Date.now() + 86400000) })
    .returning();
  auctionId = auc.id;
  await db.insert(bids).values({ auctionId: auc.id, bidderName: "Timeline Tester", bidderEmail: email, amount: "150" });
});

afterAll(async () => {
  await db.delete(bids).where(eq(bids.auctionId, auctionId));
  await db.delete(auctions).where(eq(auctions.id, auctionId));
  await db.delete(artworks).where(eq(artworks.id, artworkId));
  await db.delete(inquiries).where(eq(inquiries.email, email));
  await db.delete(contacts).where(eq(contacts.email, email));
});

describe("contacts.list", () => {
  it("finds a contact by email search", async () => {
    const caller = createCaller(ctx);
    const res = await caller.contacts.list({ search: email });
    expect(res.items.some((c) => c.email === email)).toBe(true);
    expect(typeof res.total).toBe("number");
  });
});

describe("contacts.get", () => {
  it("returns the contact plus a merged, newest-first timeline", async () => {
    const caller = createCaller(ctx);
    const list = await caller.contacts.list({ search: email });
    const id = list.items.find((c) => c.email === email)!.id;
    const res = await caller.contacts.get({ id });
    expect(res.contact.email).toBe(email);
    const types = res.timeline.map((e) => e.type);
    expect(types).toContain("inquiry");
    expect(types).toContain("bid");
    for (let i = 1; i < res.timeline.length; i++) {
      expect(new Date(res.timeline[i - 1].at).getTime()).toBeGreaterThanOrEqual(
        new Date(res.timeline[i].at).getTime(),
      );
    }
  });
});

describe("contacts.update", () => {
  it("updates only tags, notes, and doNotContact", async () => {
    const caller = createCaller(ctx);
    const list = await caller.contacts.list({ search: email });
    const id = list.items.find((c) => c.email === email)!.id;
    const updated = await caller.contacts.update({
      id,
      tags: ["collector", "VIP"],
      notes: "met at the spring show",
      doNotContact: true,
    });
    expect(updated.tags).toEqual(["collector", "VIP"]);
    expect(updated.notes).toBe("met at the spring show");
    expect(updated.doNotContact).toBe(true);
    expect(updated.email).toBe(email);
  });

  it("rejects an unauthenticated caller", async () => {
    const anon = createCaller({ db, userId: null } as const);
    await expect(anon.contacts.list({})).rejects.toThrow();
  });
});

describe("contacts.get with mixed-case source email", () => {
  const mixed = `Mixed-${Date.now()}-${Math.random()}@Example.com`;
  const lowered = mixed.toLowerCase();

  afterAll(async () => {
    await db.delete(inquiries).where(eq(inquiries.email, mixed));
    await db.delete(contacts).where(eq(contacts.email, lowered));
  });

  it("matches the inquiry timeline event despite email casing", async () => {
    const caller = createCaller(ctx);
    // Public inquiry stores the email as-typed (mixed case); upsertContact lowercases the contact.
    await caller.inquiries.create({
      name: "Casing Tester",
      email: mixed,
      pieceInterest: "Casing Piece",
      message: "hi",
    });
    const list = await caller.contacts.list({ search: lowered });
    const found = list.items.find((c) => c.email === lowered);
    expect(found).toBeTruthy();
    const res = await caller.contacts.get({ id: found!.id });
    expect(res.contact.email).toBe(lowered);
    expect(res.timeline.map((e) => e.type)).toContain("inquiry");
  });
});
