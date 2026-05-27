import { describe, it, expect, afterAll } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { createCaller } from "../root";
import { db } from "../../client";
import { contacts, inquiries, newsletterSubscribers } from "../../schema";

const ctx = { db, userId: null } as const;
const emails: string[] = [];

afterAll(async () => {
  if (emails.length) {
    await db.delete(inquiries).where(inArray(inquiries.email, emails));
    await db.delete(newsletterSubscribers).where(inArray(newsletterSubscribers.email, emails));
    await db.delete(contacts).where(inArray(contacts.email, emails));
  }
});

describe("contact sync on touchpoints", () => {
  it("creates a contact when an inquiry is submitted", async () => {
    const email = `inq-${Date.now()}-${Math.random()}@example.com`;
    emails.push(email);
    const caller = createCaller(ctx);
    await caller.inquiries.create({
      name: "Inq Person",
      email,
      pieceInterest: "Whispers",
      message: "hi",
    });
    const [row] = await db.select().from(contacts).where(eq(contacts.email, email));
    expect(row).toBeTruthy();
    expect(row.name).toBe("Inq Person");
  });

  it("creates a contact when someone subscribes to the newsletter", async () => {
    const email = `news-${Date.now()}-${Math.random()}@example.com`;
    emails.push(email);
    const caller = createCaller(ctx);
    await caller.newsletter.subscribe({ email });
    const [row] = await db.select().from(contacts).where(eq(contacts.email, email));
    expect(row).toBeTruthy();
  });
});
