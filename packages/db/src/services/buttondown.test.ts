import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { inArray } from "drizzle-orm";
import { db } from "../client";
import { newsletterSubscribers, contacts } from "../schema";
import { subscribeToButtondown } from "./buttondown";

const emails: string[] = [];

afterAll(async () => {
  if (emails.length) {
    await db.delete(newsletterSubscribers).where(inArray(newsletterSubscribers.email, emails));
    await db.delete(contacts).where(inArray(contacts.email, emails));
  }
});

beforeEach(() => {
  vi.restoreAllMocks();
  process.env.BUTTONDOWN_API_KEY = "test-key";
});

describe("subscribeToButtondown", () => {
  it("posts email with source tag and metadata", async () => {
    const email = `bd-${Date.now()}-${Math.random()}@example.com`;
    emails.push(email);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "sub_1" }), { status: 201 }),
    );

    const result = await subscribeToButtondown({ email, source: "footer", locale: "en" });

    expect(result).toEqual({ alreadySubscribed: false });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.buttondown.com/v1/subscribers",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Token test-key",
          "X-API-Version": "2026-04-01",
          "X-Buttondown-Collision-Behavior": "add",
        }),
      }),
    );
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body).toEqual({
      email_address: email,
      tags: ["footer"],
      metadata: { source: "footer", locale: "en" },
    });

    const [row] = await db
      .select()
      .from(newsletterSubscribers)
      .where(inArray(newsletterSubscribers.email, [email]));
    expect(row).toBeTruthy();
  });

  it("defensively treats any 400 as already-subscribed (collision header should make this rare)", async () => {
    const email = `dup-${Date.now()}-${Math.random()}@example.com`;
    emails.push(email);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('{"detail":"already subscribed"}', { status: 400 }),
    );

    const result = await subscribeToButtondown({ email, source: "footer" });

    expect(result).toEqual({ alreadySubscribed: true });
  });

  it("does not fail when Buttondown is unreachable; still writes local row", async () => {
    const email = `fail-${Date.now()}-${Math.random()}@example.com`;
    emails.push(email);
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("network down"));

    const result = await subscribeToButtondown({ email, source: "inquiry" });

    expect(result).toEqual({ alreadySubscribed: false });
    const [row] = await db
      .select()
      .from(newsletterSubscribers)
      .where(inArray(newsletterSubscribers.email, [email]));
    expect(row).toBeTruthy();
  });

  it("returns alreadySubscribed=false when API key is unset", async () => {
    delete process.env.BUTTONDOWN_API_KEY;
    const email = `nokey-${Date.now()}-${Math.random()}@example.com`;
    emails.push(email);
    const result = await subscribeToButtondown({ email, source: "footer" });
    expect(result).toEqual({ alreadySubscribed: false });
  });
});
