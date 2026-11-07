import { describe, it, expect, afterAll } from "vitest";
import { inArray } from "drizzle-orm";
import { createCaller } from "../root";
import { db } from "../../client";
import { collections, artworks } from "../../schema";

const caller = createCaller({ db, userId: "test-admin" } as const);
const suffix = `${Date.now()}-${Math.random()}`;
const collIds: string[] = [];
const artIds: string[] = [];

afterAll(async () => {
  if (artIds.length) await db.delete(artworks).where(inArray(artworks.id, artIds));
  if (collIds.length) await db.delete(collections).where(inArray(collections.id, collIds));
});

async function collection(name: string) {
  const c = await caller.collections.create({ title: `${name}-${suffix}` });
  collIds.push(c.id);
  return c;
}

async function piece(name: string) {
  const a = await caller.artworks.create({ title: `${name}-${suffix}` });
  artIds.push(a.id);
  return a;
}

describe("collections.setMembership", () => {
  it("adds a piece to the end of the collection", async () => {
    const c = await collection("mem-add");
    const [a1, a2, a3] = [await piece("mem-a1"), await piece("mem-a2"), await piece("mem-a3")];
    await caller.collections.setPieces({ collectionId: c.id, artworkIds: [a2.id, a1.id] });

    await caller.collections.setMembership({ collectionId: c.id, artworkId: a3.id, member: true });

    expect(await caller.collections.getPieceIds({ collectionId: c.id })).toEqual([a2.id, a1.id, a3.id]);
  });

  it("adding a piece already in the collection leaves it where it is", async () => {
    const c = await collection("mem-twice");
    const [a1, a2] = [await piece("mem-t1"), await piece("mem-t2")];
    await caller.collections.setPieces({ collectionId: c.id, artworkIds: [a1.id, a2.id] });

    await caller.collections.setMembership({ collectionId: c.id, artworkId: a1.id, member: true });

    expect(await caller.collections.getPieceIds({ collectionId: c.id })).toEqual([a1.id, a2.id]);
  });

  it("removes only that piece, keeping the others' order", async () => {
    const c = await collection("mem-remove");
    const [a1, a2, a3] = [await piece("mem-r1"), await piece("mem-r2"), await piece("mem-r3")];
    await caller.collections.setPieces({ collectionId: c.id, artworkIds: [a3.id, a1.id, a2.id] });

    await caller.collections.setMembership({ collectionId: c.id, artworkId: a1.id, member: false });

    expect(await caller.collections.getPieceIds({ collectionId: c.id })).toEqual([a3.id, a2.id]);
  });
});

describe("artworks.list collectionIds", () => {
  it("lists the collections each piece belongs to", async () => {
    const [c1, c2] = [await collection("ids-1"), await collection("ids-2")];
    const [a1, a2] = [await piece("ids-a1"), await piece("ids-a2")];
    await caller.collections.setPieces({ collectionId: c1.id, artworkIds: [a1.id] });
    await caller.collections.setPieces({ collectionId: c2.id, artworkIds: [a1.id] });

    const list = await caller.artworks.list();

    expect(list.find((a) => a.id === a1.id)?.collectionIds.sort()).toEqual([c1.id, c2.id].sort());
    expect(list.find((a) => a.id === a2.id)?.collectionIds).toEqual([]);
  });
});
