import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { inArray, eq } from "drizzle-orm";
import { db } from "../client";
import { inquiries } from "../schema";
import { sendOverdueInquirerFollowups } from "./inquirer-followup";

const ids: string[] = [];

afterAll(async () => {
  if (ids.length) {
    await db.delete(inquiries).where(inArray(inquiries.id, ids));
  }
});

beforeEach(() => {
  vi.restoreAllMocks();
  process.env.RESEND_API_KEY = "test-key";
  process.env.RESEND_FROM_EMAIL = "maeve@vamy.art";
});

async function insertInquiry(opts: {
  name: string;
  email: string;
  pieceInterest: string;
  handledDaysAgo: number | null;
  followupSent?: boolean;
}) {
  const [row] = await db
    .insert(inquiries)
    .values({
      name: opts.name,
      email: opts.email,
      pieceInterest: opts.pieceInterest,
    })
    .returning();
  ids.push(row!.id);

  if (opts.handledDaysAgo !== null) {
    await db
      .update(inquiries)
      .set({
        handledAt: new Date(Date.now() - opts.handledDaysAgo * 24 * 60 * 60 * 1000),
        ...(opts.followupSent ? { followupSentAt: new Date() } : {}),
      })
      .where(eq(inquiries.id, row!.id));
  }
  return row!.id;
}

describe("sendOverdueInquirerFollowups", () => {
  it("sends followup for inquiry handled 15 days ago and stamps followup_sent_at", async () => {
    const tag = `${Date.now()}-${Math.random()}`;
    const id = await insertInquiry({
      name: "Alice Tester",
      email: `overdue-${tag}@example.com`,
      pieceInterest: "Wandering Light",
      handledDaysAgo: 15,
    });

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "email_1" }), { status: 200 }),
    );

    const result = await sendOverdueInquirerFollowups();

    expect(result.sent).toBeGreaterThanOrEqual(1);
    const sendCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("api.resend.com"),
    );
    expect(sendCalls.length).toBeGreaterThanOrEqual(1);
    const sentForThis = sendCalls.find(([, init]) => {
      const body = JSON.parse((init as RequestInit).body as string);
      const to = Array.isArray(body.to) ? body.to[0] : body.to;
      return to === `overdue-${tag}@example.com`;
    });
    expect(sentForThis).toBeTruthy();
    const body = JSON.parse((sentForThis![1] as RequestInit).body as string);
    expect(body.subject).toBe("About Wandering Light");
    expect(body.text).toContain("Alice Tester");
    expect(body.text).toContain("Wandering Light");

    const [row] = await db.select().from(inquiries).where(eq(inquiries.id, id));
    expect(row!.followupSentAt).not.toBeNull();
  });

  it("does not pick up inquiries handled only 13 days ago", async () => {
    const tag = `${Date.now()}-${Math.random()}`;
    const id = await insertInquiry({
      name: "Bob Recent",
      email: `recent-${tag}@example.com`,
      pieceInterest: "Quiet Morning",
      handledDaysAgo: 13,
    });

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "email_x" }), { status: 200 }),
    );

    await sendOverdueInquirerFollowups();

    const sentToBob = fetchMock.mock.calls.some(([url, init]) => {
      if (!String(url).includes("api.resend.com")) return false;
      const body = JSON.parse((init as RequestInit).body as string);
      const to = Array.isArray(body.to) ? body.to[0] : body.to;
      return to === `recent-${tag}@example.com`;
    });
    expect(sentToBob).toBe(false);

    const [row] = await db.select().from(inquiries).where(eq(inquiries.id, id));
    expect(row!.followupSentAt).toBeNull();
  });

  it("skips inquiries that already have followup_sent_at set", async () => {
    const tag = `${Date.now()}-${Math.random()}`;
    await insertInquiry({
      name: "Carol Done",
      email: `done-${tag}@example.com`,
      pieceInterest: "Old Piece",
      handledDaysAgo: 20,
      followupSent: true,
    });

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "email_y" }), { status: 200 }),
    );

    await sendOverdueInquirerFollowups();

    const sentToCarol = fetchMock.mock.calls.some(([url, init]) => {
      if (!String(url).includes("api.resend.com")) return false;
      const body = JSON.parse((init as RequestInit).body as string);
      const to = Array.isArray(body.to) ? body.to[0] : body.to;
      return to === `done-${tag}@example.com`;
    });
    expect(sentToCarol).toBe(false);
  });

  it("returns sent=0 and does not call fetch when RESEND_API_KEY is unset", async () => {
    delete process.env.RESEND_API_KEY;
    const tag = `${Date.now()}-${Math.random()}`;
    await insertInquiry({
      name: "Dan Nokey",
      email: `nokey-${tag}@example.com`,
      pieceInterest: "Untitled",
      handledDaysAgo: 30,
    });

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );

    const result = await sendOverdueInquirerFollowups();

    expect(result.sent).toBe(0);
    expect(result.skipped).toBeGreaterThanOrEqual(1);
    const resendCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("api.resend.com"),
    );
    expect(resendCalls.length).toBe(0);
  });
});
