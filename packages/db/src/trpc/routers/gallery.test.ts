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
  const [first, second, hidden] = await db
    .insert(artworks)
    .values([
      { slug: slug("g-first"), title: "A first", published: true, sortOrder: 0 },
      { slug: slug("g-second"), title: "B second", published: true, sortOrder: 1 },
      { slug: slug("g-hidden"), title: "C hidden", published: false },
    ])
    .returning();
  artworkIds.push(first.id, second.id, hidden.id);
  await db.insert(artworkImages).values({
    artworkId: first.id,
    storagePath: `test/${suffix}.jpg`,
    isPrimary: true,
    width: 1000,
    height: 1250,
  });

  const [on, off] = await db
    .insert(collections)
    .values([
      { slug: slug("g-on"), title: `On ${suffix}`, published: true, onLanding: true, sortOrder: -100 },
      { slug: slug("g-off"), title: `Off ${suffix}`, published: true, onLanding: false, sortOrder: -99 },
    ])
    .returning();
  collectionIds.push(on.id, off.id);
  await db.insert(artworkCollections).values([
    { collectionId: on.id, artworkId: first.id, sortOrder: 0 },
    { collectionId: on.id, artworkId: second.id, sortOrder: 1 },
    { collectionId: off.id, artworkId: hidden.id, sortOrder: 0 },
  ]);
});

afterAll(async () => {
  if (collectionIds.length) await db.delete(collections).where(inArray(collections.id, collectionIds));
  if (artworkIds.length) await db.delete(artworks).where(inArray(artworks.id, artworkIds));
});

describe("gallery router", () => {
  it("landing lists the on-landing collection's pieces in order, none from the off collection", async () => {
    const slugs = (await caller.gallery.landing()).map((p) => p.slug);
    expect(slugs.indexOf(slug("g-first"))).toBeGreaterThanOrEqual(0);
    expect(slugs.indexOf(slug("g-second"))).toBe(slugs.indexOf(slug("g-first")) + 1);
    expect(slugs).not.toContain(slug("g-hidden"));
  });

  it("wall filters include the public collection but not the off-landing one with only a hidden piece", async () => {
    const { filters } = await caller.gallery.wall({});
    expect(filters.map((f) => f.slug)).toContain(slug("g-on"));
    expect(filters.map((f) => f.slug)).not.toContain(slug("g-off"));
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
