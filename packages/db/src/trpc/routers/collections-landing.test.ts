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
  it("counts assigned pieces", async () => {
    const c = await caller.collections.create({ title: `count-${suffix}` });
    collIds.push(c.id);
    const listed = (await caller.collections.list()).find((x) => x.id === c.id);
    expect(listed?.pieceCount).toBe(0);
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
