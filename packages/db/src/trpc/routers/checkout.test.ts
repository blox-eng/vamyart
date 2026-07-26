import { describe, it, expect, afterAll } from "vitest";
import { inArray } from "drizzle-orm";
import { createCaller } from "../root";
import { db } from "../../client";
import { productVariants, products, artworks } from "../../schema";

const ctx = { db, userId: null } as const;

const createdArtworkIds: string[] = [];
const createdProductIds: string[] = [];
const createdVariantIds: string[] = [];

async function seedArtworkAndProduct() {
  const [aw] = await db
    .insert(artworks)
    .values({ slug: `checkout-${Date.now()}-${Math.random()}`, title: "T" })
    .returning();
  const [p] = await db
    .insert(products)
    .values({ artworkId: aw.id, productType: "print", name: "P" })
    .returning();
  createdArtworkIds.push(aw.id);
  createdProductIds.push(p.id);
  return { aw, p };
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

describe("checkout.createSession — sold rejection", () => {
  it("rejects a variant explicitly flagged sold (soldAt set)", async () => {
    const { p } = await seedArtworkAndProduct();
    const [v] = await db
      .insert(productVariants)
      .values({
        productId: p.id,
        name: "V",
        price: "10",
        stockQuantity: 5,
        available: true,
        soldAt: new Date(),
      })
      .returning();
    createdVariantIds.push(v.id);

    const caller = createCaller(ctx);
    await expect(
      caller.checkout.createSession({ variantId: v.id }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("rejects a one-of-a-kind original that has sold out (stockQuantity 0)", async () => {
    const { p } = await seedArtworkAndProduct();
    const [v] = await db
      .insert(productVariants)
      .values({
        productId: p.id,
        name: "V",
        price: "10",
        stockQuantity: 0,
        available: true,
        isOriginal: true,
        soldAt: null,
      })
      .returning();
    createdVariantIds.push(v.id);

    const caller = createCaller(ctx);
    await expect(
      caller.checkout.createSession({ variantId: v.id }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});
