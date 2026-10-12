import { describe, it, expect, afterAll } from "vitest";
import { inArray, eq } from "drizzle-orm";
import { createCaller } from "../root";
import { db } from "../../client";
import { collections, artworks } from "../../schema";

const caller = createCaller({ db, userId: "test-admin" } as const);
const suffix = `${Date.now()}-${Math.random()}`;
const collIds: string[] = [];

afterAll(async () => {
  if (collIds.length) await db.delete(collections).where(inArray(collections.id, collIds));
});

describe("collections.onLanding", () => {
  it("new collections default to the landing page", async () => {
    const c = await caller.collections.create({ title: `land-${suffix}` });
    collIds.push(c.id);
    expect(c.onLanding).toBe(true);
  });

  it("update toggles onLanding", async () => {
    const c = await caller.collections.create({ title: `land2-${suffix}` });
    collIds.push(c.id);
    const u = await caller.collections.update({ id: c.id, onLanding: false });
    expect(u.onLanding).toBe(false);
    const listed = (await caller.collections.list()).find((x) => x.id === c.id);
    expect(listed?.onLanding).toBe(false);
  });
});

describe("collections.list pieceCount", () => {
  it("counts assigned pieces, excluding soft-deleted ones", async () => {
    const c = await caller.collections.create({ title: `count-${suffix}` });
    collIds.push(c.id);
    const listed0 = (await caller.collections.list()).find((x) => x.id === c.id);
    expect(listed0?.pieceCount).toBe(0);

    const a1 = await caller.artworks.create({ title: `cnt-a-${suffix}` });
    const a2 = await caller.artworks.create({ title: `cnt-b-${suffix}` });
    try {
      await caller.collections.setPieces({ collectionId: c.id, artworkIds: [a1.id, a2.id] });
      const two = (await caller.collections.list()).find((x) => x.id === c.id);
      expect(two?.pieceCount).toBe(2);

      await caller.artworks.delete({ id: a2.id });
      const one = (await caller.collections.list()).find((x) => x.id === c.id);
      expect(one?.pieceCount).toBe(1);
      expect(await caller.collections.getPieceIds({ collectionId: c.id })).toEqual([a1.id]);
    } finally {
      await db.delete(artworks).where(inArray(artworks.id, [a1.id, a2.id]));
    }
  });
});

describe("collections.setPieces with soft-deleted pieces", () => {
  it("keeps deleted pieces' membership so restore brings them back", async () => {
    const c = await caller.collections.create({ title: `keep-${suffix}` });
    collIds.push(c.id);
    const a1 = await caller.artworks.create({ title: `keep-a-${suffix}` });
    const a2 = await caller.artworks.create({ title: `keep-b-${suffix}` });
    try {
      await caller.collections.setPieces({ collectionId: c.id, artworkIds: [a1.id, a2.id] });
      await caller.artworks.delete({ id: a2.id });
      await caller.collections.setPieces({ collectionId: c.id, artworkIds: [a1.id] });
      await caller.artworks.restore({ id: a2.id });
      expect(await caller.collections.getPieceIds({ collectionId: c.id })).toEqual([a1.id, a2.id]);
    } finally {
      await db.delete(artworks).where(inArray(artworks.id, [a1.id, a2.id]));
    }
  });
});

describe("trim on save", () => {
  it("trims collection titles on create and update", async () => {
    const c = await caller.collections.create({ title: `  trim-${suffix}  ` });
    collIds.push(c.id);
    expect(c.title).toBe(`trim-${suffix}`);
    const u = await caller.collections.update({ id: c.id, title: `  trim2-${suffix}  ` });
    expect(u.title).toBe(`trim2-${suffix}`);
  });

  it("trims piece title and medium", async () => {
    const a = await caller.artworks.create({ title: `  piece-${suffix}  `, medium: "  Oil  " });
    try {
      expect(a.title).toBe(`piece-${suffix}`);
      expect(a.medium).toBe("Oil");
      const u = await caller.artworks.update({ id: a.id, medium: "  Ink " });
      expect(u.medium).toBe("Ink");
    } finally {
      await db.delete(artworks).where(eq(artworks.id, a.id));
    }
  });
});
