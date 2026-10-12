import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { inArray } from "drizzle-orm";
import { createCaller } from "../root";
import { db } from "../../client";
import { artworks, artworkImages, artworkCollections, collections } from "../../schema";

const caller = createCaller({ db, userId: "test-admin" } as const);
const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const slug = (s: string) => `${s}-${suffix}`;
const artworkIds: string[] = [];
const collectionIds: string[] = [];

beforeAll(async () => {
  const [first, second, hidden, offPiece] = await db
    .insert(artworks)
    .values([
      { slug: slug("g-first"), title: "A first", published: true, sortOrder: 0 },
      { slug: slug("g-second"), title: "B second", published: true, sortOrder: 1 },
      { slug: slug("g-hidden"), title: "C hidden", published: false },
      { slug: slug("g-offpiece"), title: "D off landing", published: true, sortOrder: 2 },
    ])
    .returning();
  artworkIds.push(first.id, second.id, hidden.id, offPiece.id);
  await db.insert(artworkImages).values({
    artworkId: first.id,
    storagePath: `test/${suffix}.jpg`,
    isPrimary: true,
    width: 1000,
    height: 1250,
  });

  const [on, off, draftOnly] = await db
    .insert(collections)
    .values([
      { slug: slug("g-on"), title: `On ${suffix}`, published: true, onLanding: true, sortOrder: -100 },
      { slug: slug("g-off"), title: `Off ${suffix}`, published: true, onLanding: false, sortOrder: -99 },
      { slug: slug("g-draftonly"), title: `Draft only ${suffix}`, published: true, sortOrder: -98 },
    ])
    .returning();
  collectionIds.push(on.id, off.id, draftOnly.id);
  await db.insert(artworkCollections).values([
    { collectionId: on.id, artworkId: first.id, sortOrder: 0 },
    { collectionId: on.id, artworkId: second.id, sortOrder: 1 },
    { collectionId: off.id, artworkId: offPiece.id, sortOrder: 0 },
    { collectionId: draftOnly.id, artworkId: hidden.id, sortOrder: 0 },
  ]);
});

afterAll(async () => {
  if (collectionIds.length) await db.delete(collections).where(inArray(collections.id, collectionIds));
  if (artworkIds.length) await db.delete(artworks).where(inArray(artworks.id, artworkIds));
});

describe("gallery router", () => {
  it("landing lists the on-landing collection's pieces in order and omits the onLanding:false collection's published piece", async () => {
    const slugs = (await caller.gallery.landing()).map((p) => p.slug);
    expect(slugs.indexOf(slug("g-first"))).toBeGreaterThanOrEqual(0);
    expect(slugs.indexOf(slug("g-second"))).toBe(slugs.indexOf(slug("g-first")) + 1);
    expect(slugs).not.toContain(slug("g-offpiece"));
  });

  it("wall({}) keeps the onLanding:false collection as a filter and lists its piece", async () => {
    const { filters, pieces } = await caller.gallery.wall({});
    expect(filters.map((f) => f.slug)).toEqual(expect.arrayContaining([slug("g-on"), slug("g-off")]));
    expect(pieces.map((p) => p.slug)).toContain(slug("g-offpiece"));
  });

  it("a collection holding only an unpublished piece is not a filter", async () => {
    const { filters, pieces } = await caller.gallery.wall({});
    expect(filters.map((f) => f.slug)).not.toContain(slug("g-draftonly"));
    expect(pieces.map((p) => p.slug)).not.toContain(slug("g-hidden"));
  });

  it("wall with a collectionSlug returns only that collection's pieces and its title", async () => {
    const { pieces, collection } = await caller.gallery.wall({ collectionSlug: slug("g-on") });
    expect(pieces.map((p) => p.slug)).toEqual([slug("g-first"), slug("g-second")]);
    expect(collection?.title).toBe(`On ${suffix}`);
  });

  it("wall rejects an unknown collection with NOT_FOUND", async () => {
    await expect(caller.gallery.wall({ collectionSlug: "nope-" + suffix })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("returns image dimensions", async () => {
    const { pieces } = await caller.gallery.wall({ collectionSlug: slug("g-on") });
    expect(pieces[0].image).toMatchObject({ width: 1000, height: 1250 });
    expect(pieces[1].image).toBeNull();
  });
});
