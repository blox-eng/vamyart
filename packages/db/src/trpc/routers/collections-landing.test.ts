import { describe, it, expect, afterAll } from "vitest";
import { inArray } from "drizzle-orm";
import { createCaller } from "../root";
import { db } from "../../client";
import { collections } from "../../schema";

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
