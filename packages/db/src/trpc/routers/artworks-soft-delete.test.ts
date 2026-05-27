import { describe, it, expect, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { createCaller } from "../root";
import { db } from "../../client";
import { artworks, products, productVariants, orders } from "../../schema";

const ctx = { db, userId: "test-admin" } as const;
const caller = createCaller(ctx);

const suffix = `${Date.now()}-${Math.random()}`;
const slug = `soft-del-${suffix}`;
const createdArtworkIds: string[] = [];

async function makeArtwork(s: string, title: string) {
  const a = await caller.artworks.create({ title, slug: s, published: true });
  createdArtworkIds.push(a.id);
  return a;
}

afterAll(async () => {
  for (const id of createdArtworkIds) {
    const prods = await db.select({ id: products.id }).from(products).where(eq(products.artworkId, id));
    for (const p of prods) {
      const vars = await db.select({ id: productVariants.id }).from(productVariants).where(eq(productVariants.productId, p.id));
      for (const v of vars) {
        await db.delete(orders).where(eq(orders.productVariantId, v.id));
      }
      await db.delete(productVariants).where(eq(productVariants.productId, p.id));
    }
    await db.delete(products).where(eq(products.artworkId, id));
    await db.delete(artworks).where(eq(artworks.id, id));
  }
});

describe("artworks soft delete", () => {
  it("delete sets deleted_at, keeps the row, and hides it from list/listPublic/getBySlug", async () => {
    const a = await makeArtwork(slug, "Soft Delete Target");
    await caller.artworks.delete({ id: a.id });

    const row = await db.query.artworks.findFirst({ where: eq(artworks.id, a.id) });
    expect(row).toBeTruthy();
    expect(row!.deletedAt).not.toBeNull();

    const list = await caller.artworks.list();
    expect(list.some((x) => x.id === a.id)).toBe(false);

    const pub = await caller.artworks.listPublic();
    expect(pub.some((x) => x.id === a.id)).toBe(false);

    const bySlug = await caller.artworks.getBySlug({ slug });
    expect(bySlug).toBeNull();
  });

  it("restore clears deleted_at and brings the piece back into list", async () => {
    const a = await makeArtwork(`${slug}-restore`, "Restore Target");
    await caller.artworks.delete({ id: a.id });
    await caller.artworks.restore({ id: a.id });

    const row = await db.query.artworks.findFirst({ where: eq(artworks.id, a.id) });
    expect(row!.deletedAt).toBeNull();

    const list = await caller.artworks.list();
    expect(list.some((x) => x.id === a.id)).toBe(true);

    const trashed = await caller.artworks.listTrashed();
    expect(trashed.some((x) => x.id === a.id)).toBe(false);
  });

  it("listTrashed returns only trashed pieces", async () => {
    const live = await makeArtwork(`${slug}-live`, "Live Piece");
    const dead = await makeArtwork(`${slug}-dead`, "Dead Piece");
    await caller.artworks.delete({ id: dead.id });

    const trashed = await caller.artworks.listTrashed();
    expect(trashed.some((x) => x.id === dead.id)).toBe(true);
    expect(trashed.some((x) => x.id === live.id)).toBe(false);
  });

  it("delete is blocked (CONFLICT) when the piece has an order, and deleted_at stays null", async () => {
    const a = await makeArtwork(`${slug}-guard`, "Guarded Piece");
    const [p] = await db
      .insert(products)
      .values({ artworkId: a.id, name: "Print", productType: "print" })
      .returning();
    const [v] = await db
      .insert(productVariants)
      .values({ productId: p.id, name: "A3", price: "100", stockQuantity: 1 })
      .returning();
    await db.insert(orders).values({
      productVariantId: v.id,
      buyerName: "Buyer",
      buyerEmail: `buyer-${suffix}@example.com`,
      shippingAddress: { line1: "1 Test St", city: "Sofia", country: "BG" },
      amountPaid: "100",
      stripeSessionId: `cs_test_${suffix}`,
      status: "paid",
    });

    await expect(caller.artworks.delete({ id: a.id })).rejects.toThrow(/order/i);

    const row = await db.query.artworks.findFirst({ where: eq(artworks.id, a.id) });
    expect(row!.deletedAt).toBeNull();
  });
});
