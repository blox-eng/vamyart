import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { createCaller } from "../root";
import { db } from "../../client";
import { collections, artworks, artworkImages } from "../../schema";

// Real-DB suite, same pattern as artworks-featured.test.ts. The single-featured
// invariant touches every collection row, so snapshot the pre-existing featured
// collection(s) and restore in afterAll.
const ctx = { db, userId: "test-admin" } as const;
const caller = createCaller(ctx);

const suffix = `${Date.now()}-${Math.random()}`;
const collIds: string[] = [];
const artIds: string[] = [];
let preFeatured: string[] = [];

async function makeCollection(name: string, opts: { published?: boolean } = {}) {
  const c = await caller.collections.create({ title: `coll-${name}-${suffix}` });
  collIds.push(c.id);
  if (opts.published) {
    await caller.collections.update({ id: c.id, published: true });
  }
  return c;
}

async function makePiece(name: string, opts: { published?: boolean } = {}) {
  const a = await caller.artworks.create({
    title: `cp-${name}`,
    slug: `cp-${name}-${suffix}`,
    published: opts.published ?? true,
  });
  artIds.push(a.id);
  await db.insert(artworkImages).values({
    artworkId: a.id,
    storagePath: `cp-${suffix}/${a.id}.jpg`,
    isPrimary: true,
    sortOrder: 0,
  });
  return a;
}

beforeAll(async () => {
  const rows = await db.select({ id: collections.id }).from(collections).where(eq(collections.featured, true));
  preFeatured = rows.map((r) => r.id);
  // Clear the live featured flag so the raw partial unique index (Task 3) does
  // not reject this suite's own setFeatured calls. Restored in afterAll.
  if (preFeatured.length) {
    await db.update(collections).set({ featured: false }).where(inArray(collections.id, preFeatured));
  }
});

afterAll(async () => {
  if (collIds.length) await db.delete(collections).where(inArray(collections.id, collIds));
  if (artIds.length) await db.delete(artworks).where(inArray(artworks.id, artIds)); // artwork_images cascades
  if (preFeatured.length) {
    // Restore a single featured collection (invariant guarantees exactly one).
    await db.update(collections).set({ featured: true }).where(eq(collections.id, preFeatured[0]));
  }
});

describe("collections.setFeatured single-featured invariant", () => {
  it("featuring one collection unfeatures every other", async () => {
    const a = await makeCollection("alpha", { published: true });
    const b = await makeCollection("beta", { published: true });

    await caller.collections.setFeatured({ id: a.id, featured: true });
    await caller.collections.setFeatured({ id: b.id, featured: true });

    const rowA = await db.query.collections.findFirst({ where: eq(collections.id, a.id) });
    const rowB = await db.query.collections.findFirst({ where: eq(collections.id, b.id) });
    expect(rowA?.featured).toBe(false);
    expect(rowB?.featured).toBe(true);
  });

  it("the DB rejects a second featured collection (partial unique index)", async () => {
    const a = await makeCollection("gamma", { published: true });
    const b = await makeCollection("delta", { published: true });
    await caller.collections.setFeatured({ id: a.id, featured: true });

    // Bypass the router and force a second featured row directly — the raw
    // partial unique index from Task 3 must reject it.
    await expect(
      db.update(collections).set({ featured: true }).where(eq(collections.id, b.id))
    ).rejects.toThrow();

    // Clean the one we could not clear via the router so afterAll delete works.
    await caller.collections.setFeatured({ id: a.id, featured: false });
  });
});

describe("collections public-read filters", () => {
  it("getBySlug returns null for an unpublished collection", async () => {
    const c = await makeCollection("epsilon"); // published defaults false
    expect(await caller.collections.getBySlug({ slug: c.slug })).toBeNull();
  });

  it("getFeatured returns null when the featured collection is unpublished", async () => {
    const c = await makeCollection("zeta"); // unpublished
    await caller.collections.setFeatured({ id: c.id, featured: true });
    expect(await caller.collections.getFeatured()).toBeNull();
    await caller.collections.setFeatured({ id: c.id, featured: false });
  });

  it("listPublic excludes unpublished collections", async () => {
    const pub = await makeCollection("eta", { published: true });
    const draft = await makeCollection("theta");
    const slugs = (await caller.collections.listPublic()).map((c) => c.slug);
    expect(slugs).toContain(pub.slug);
    expect(slugs).not.toContain(draft.slug);
  });
});

describe("collections.setPieces", () => {
  it("stores pieces in the given order and getBySlug returns them ordered", async () => {
    const c = await makeCollection("iota", { published: true });
    const p1 = await makePiece("one");
    const p2 = await makePiece("two");

    await caller.collections.setPieces({ collectionId: c.id, artworkIds: [p2.id, p1.id] });

    const detail = await caller.collections.getBySlug({ slug: c.slug });
    expect(detail?.pieces.map((p) => p.slug)).toEqual([p2.slug, p1.slug]);
  });

  it("rejects duplicate artwork ids", async () => {
    const c = await makeCollection("kappa", { published: true });
    const p = await makePiece("dup");
    await expect(
      caller.collections.setPieces({ collectionId: c.id, artworkIds: [p.id, p.id] })
    ).rejects.toThrow(/duplicate/i);
  });
});
