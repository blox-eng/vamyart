import { describe, it, expect } from "vitest";
import { eq, and } from "drizzle-orm";
import { createCaller } from "../root";
import { db } from "../../client";
import { variantWaitlist, productVariants, products, artworks } from "../../schema";

const ctx = { db, userId: null } as const;

async function seedVariant() {
  const [aw] = await db.insert(artworks).values({ slug: `wl-${Date.now()}-${Math.random()}`, title: "T" }).returning();
  const [p] = await db.insert(products).values({ artworkId: aw.id, productType: "print", name: "P" }).returning();
  const [v] = await db
    .insert(productVariants)
    .values({ productId: p.id, name: "V", price: "10", stockQuantity: 0, available: true })
    .returning();
  return v;
}

describe("waitlist.subscribe", () => {
  it("creates a new row for a new email/variant pair", async () => {
    const v = await seedVariant();
    const caller = createCaller(ctx);
    const res = await caller.waitlist.subscribe({ variantId: v.id, email: "a@example.com" });
    expect(res.success).toBe(true);

    const rows = await db.query.variantWaitlist.findMany({
      where: and(eq(variantWaitlist.productVariantId, v.id), eq(variantWaitlist.email, "a@example.com")),
    });
    expect(rows.length).toBe(1);
    expect(rows[0].notifiedAt).toBeNull();
  });

  it("is idempotent on duplicate unnotified subscription", async () => {
    const v = await seedVariant();
    const caller = createCaller(ctx);
    await caller.waitlist.subscribe({ variantId: v.id, email: "b@example.com" });
    await caller.waitlist.subscribe({ variantId: v.id, email: "b@example.com" });
    const rows = await db.query.variantWaitlist.findMany({
      where: and(eq(variantWaitlist.productVariantId, v.id), eq(variantWaitlist.email, "b@example.com")),
    });
    expect(rows.length).toBe(1);
  });

  it("resets notifiedAt on re-subscribe if previously notified", async () => {
    const v = await seedVariant();
    await db.insert(variantWaitlist).values({
      productVariantId: v.id,
      email: "c@example.com",
      notifiedAt: new Date(),
    });
    const caller = createCaller(ctx);
    await caller.waitlist.subscribe({ variantId: v.id, email: "c@example.com" });
    const [row] = await db.query.variantWaitlist.findMany({
      where: and(eq(variantWaitlist.productVariantId, v.id), eq(variantWaitlist.email, "c@example.com")),
    });
    expect(row.notifiedAt).toBeNull();
  });

  it("rejects invalid email", async () => {
    const v = await seedVariant();
    const caller = createCaller(ctx);
    await expect(
      caller.waitlist.subscribe({ variantId: v.id, email: "not-an-email" }),
    ).rejects.toThrow();
  });
});
