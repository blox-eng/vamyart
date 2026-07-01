import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { createCaller } from "../root";
import { db } from "../../client";
import { artworks, artworkImages } from "../../schema";

// These run against the real DB (like artworks-soft-delete.test.ts). The
// single-featured invariant touches every row, so we snapshot the pre-existing
// featured piece(s) and restore them in afterAll to avoid clobbering live data.
const ctx = { db, userId: "test-admin" } as const;
const caller = createCaller(ctx);

const suffix = `${Date.now()}-${Math.random()}`;
const createdIds: string[] = [];
let preFeatured: string[] = [];

async function makePiece(name: string, opts: { published?: boolean } = {}) {
  const a = await caller.artworks.create({
    title: name,
    slug: `feat-${name}-${suffix}`,
    published: opts.published ?? true,
  });
  createdIds.push(a.id);
  return a;
}

async function addPrimaryImage(artworkId: string) {
  await db.insert(artworkImages).values({
    artworkId,
    storagePath: `feat-${suffix}/${artworkId}.jpg`,
    isPrimary: true,
    sortOrder: 0,
  });
}

beforeAll(async () => {
  const rows = await db.select({ id: artworks.id }).from(artworks).where(eq(artworks.featured, true));
  preFeatured = rows.map((r) => r.id);
});

afterAll(async () => {
  if (createdIds.length) {
    // artwork_images cascades on artwork delete.
    await db.delete(artworks).where(inArray(artworks.id, createdIds));
  }
  // Restore the featured flag the suite's single-enforcement cleared.
  if (preFeatured.length) {
    await db.update(artworks).set({ featured: true }).where(inArray(artworks.id, preFeatured));
  }
});

describe("artworks.getFeatured", () => {
  it("returns the featured, published piece with its primary image", async () => {
    const a = await makePiece("alpha");
    await addPrimaryImage(a.id);
    await caller.artworks.setFeatured({ id: a.id, featured: true });

    const f = await caller.artworks.getFeatured();
    expect(f?.id).toBe(a.id);
    expect(f?.primaryImage?.url).toContain(`feat-${suffix}`);
  });

  it("returns null when the featured piece is not published", async () => {
    const a = await makePiece("beta", { published: false });
    await addPrimaryImage(a.id);
    await caller.artworks.setFeatured({ id: a.id, featured: true });

    expect(await caller.artworks.getFeatured()).toBeNull();
  });

  it("never returns a soft-deleted featured piece", async () => {
    const a = await makePiece("gamma");
    await addPrimaryImage(a.id);
    await caller.artworks.setFeatured({ id: a.id, featured: true });
    await caller.artworks.delete({ id: a.id });

    expect(await caller.artworks.getFeatured()).toBeNull();
  });
});

describe("artworks.setFeatured single-featured invariant", () => {
  it("featuring a piece unfeatures every other piece", async () => {
    const a = await makePiece("delta");
    await addPrimaryImage(a.id);
    const b = await makePiece("epsilon");
    await addPrimaryImage(b.id);

    await caller.artworks.setFeatured({ id: a.id, featured: true });
    await caller.artworks.setFeatured({ id: b.id, featured: true });

    const rowA = await db.query.artworks.findFirst({ where: eq(artworks.id, a.id) });
    const rowB = await db.query.artworks.findFirst({ where: eq(artworks.id, b.id) });
    expect(rowA?.featured).toBe(false);
    expect(rowB?.featured).toBe(true);

    const f = await caller.artworks.getFeatured();
    expect(f?.id).toBe(b.id);
  });
});
