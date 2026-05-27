import { describe, it, expect, afterAll } from "vitest";
import { inArray, eq } from "drizzle-orm";
import { db } from "../client";
import { contacts } from "../schema";
import { upsertContact } from "./upsert-contact";

const emails: string[] = [];
function uniq(label: string) {
  const e = `${label}-${Date.now()}-${Math.random()}@example.com`;
  emails.push(e);
  return e;
}

afterAll(async () => {
  if (emails.length) {
    await db.delete(contacts).where(inArray(contacts.email, emails));
  }
});

describe("upsertContact", () => {
  it("creates a new contact with email and name", async () => {
    const email = uniq("new");
    await upsertContact(db, { email, name: "Ada Lovelace" });
    const [row] = await db.select().from(contacts).where(eq(contacts.email, email));
    expect(row).toBeTruthy();
    expect(row.name).toBe("Ada Lovelace");
    expect(row.tags).toEqual([]);
    expect(row.doNotContact).toBe(false);
  });

  it("fills a previously-missing name on a later touchpoint", async () => {
    const email = uniq("fill");
    await upsertContact(db, { email, name: null });
    await upsertContact(db, { email, name: "Grace Hopper" });
    const [row] = await db.select().from(contacts).where(eq(contacts.email, email));
    expect(row.name).toBe("Grace Hopper");
  });

  it("never overwrites an existing name, tags, notes, or doNotContact", async () => {
    const email = uniq("preserve");
    await upsertContact(db, { email, name: "Original Name" });
    await db
      .update(contacts)
      .set({ tags: ["VIP"], notes: "met at gallery", doNotContact: true })
      .where(eq(contacts.email, email));
    await upsertContact(db, { email, name: "Different Name" });
    const [row] = await db.select().from(contacts).where(eq(contacts.email, email));
    expect(row.name).toBe("Original Name");
    expect(row.tags).toEqual(["VIP"]);
    expect(row.notes).toBe("met at gallery");
    expect(row.doNotContact).toBe(true);
  });

  it("no-ops on empty or whitespace email", async () => {
    await upsertContact(db, { email: "", name: "Nobody" });
    await upsertContact(db, { email: "   ", name: "Nobody" });
    const rows = await db.select().from(contacts).where(eq(contacts.name, "Nobody"));
    expect(rows.length).toBe(0);
  });

  it("trims and lowercases the email", async () => {
    const base = uniq("Case");
    await upsertContact(db, { email: `  ${base.toUpperCase()}  `, name: "Trimmed" });
    const [row] = await db.select().from(contacts).where(eq(contacts.email, base.toLowerCase()));
    expect(row).toBeTruthy();
    emails.push(base.toLowerCase());
  });
});
