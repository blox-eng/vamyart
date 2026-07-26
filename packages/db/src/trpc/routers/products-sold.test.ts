import { describe, it, expect, afterAll } from "vitest";
import { inArray } from "drizzle-orm";
import { createCaller } from "../root";
import { db } from "../../client";
import { productVariants, products, artworks } from "../../schema";

const ctx = { db, userId: "test-admin" } as const;

const createdArtworkIds: string[] = [];
const createdProductIds: string[] = [];
const createdVariantIds: string[] = [];

async function seedVariant() {
  const [aw] = await db
    .insert(artworks)
    .values({ slug: `sold-${Date.now()}-${Math.random()}`, title: "T" })
    .returning();
  const [p] = await db.insert(products).values({ artworkId: aw.id, productType: "print", name: "P" }).returning();
  const [v] = await db
    .insert(productVariants)
    .values({ productId: p.id, name: "V", price: "10", stockQuantity: 5, available: true })
    .returning();
  createdArtworkIds.push(aw.id);
  createdProductIds.push(p.id);
  createdVariantIds.push(v.id);
  return v;
}

afterAll(async () => {
  if (createdVariantIds.length) {
    await db.delete(productVariants).where(inArray(productVariants.id, createdVariantIds));
  }
  if (createdProductIds.length) {
    await db.delete(products).where(inArray(products.id, createdProductIds));
  }
  if (createdArtworkIds.length) {
    await db.delete(artworks).where(inArray(artworks.id, createdArtworkIds));
  }
});

describe("products.setVariantSold", () => {
  it("sets soldAt when sold: true, and clears it when sold: false", async () => {
    const v = await seedVariant();
    const caller = createCaller(ctx);

    const soldRes = await caller.products.setVariantSold({ id: v.id, sold: true });
    expect(soldRes.soldAt).not.toBeNull();

    const unsoldRes = await caller.products.setVariantSold({ id: v.id, sold: false });
    expect(unsoldRes.soldAt).toBeNull();
  });

  it("rejects an unknown variant id with NOT_FOUND", async () => {
    const caller = createCaller(ctx);
    await expect(
      caller.products.setVariantSold({
        id: "00000000-0000-0000-0000-000000000000",
        sold: true,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
