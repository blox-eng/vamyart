import { describe, it, expect, vi } from "vitest";

vi.mock("../../client", () => ({ db: {} }));
vi.mock("../../services/turnstile", () => ({ verifyHuman: vi.fn() }));
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: vi.fn() },
  })),
}));

import { validateBid, bidsRouter } from "./bids";
import { verifyHuman } from "../../services/turnstile";
import { createCaller } from "../root";

describe("bid validation", () => {
  const future = new Date(Date.now() + 1000 * 60 * 60); // 1 hour from now
  const past = new Date(Date.now() - 1000);

  it("rejects bid after deadline", () => {
    const result = validateBid({
      amount: 5000,
      currentBid: null,
      minBid: 4000,
      minIncrement: 100,
      deadline: past,
    });
    expect(result.valid).toBe(false);
    expect((result as { valid: false; reason: string }).reason).toMatch(/ended/i);
  });

  it("rejects first bid below min_bid", () => {
    const result = validateBid({
      amount: 3000,
      currentBid: null,
      minBid: 4000,
      minIncrement: 100,
      deadline: future,
    });
    expect(result.valid).toBe(false);
  });

  it("accepts first bid at min_bid", () => {
    const result = validateBid({
      amount: 4000,
      currentBid: null,
      minBid: 4000,
      minIncrement: 100,
      deadline: future,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects bid not exceeding current + increment", () => {
    const result = validateBid({
      amount: 4050,
      currentBid: 4000,
      minBid: 3000,
      minIncrement: 100,
      deadline: future,
    });
    expect(result.valid).toBe(false);
  });

  it("accepts bid exceeding current + increment", () => {
    const result = validateBid({
      amount: 4100,
      currentBid: 4000,
      minBid: 3000,
      minIncrement: 100,
      deadline: future,
    });
    expect(result.valid).toBe(true);
  });
});

describe("bids.place bot check (#61)", () => {
  it("refuses a bot before reading the auction or emailing the outbid bidder", async () => {
    vi.mocked(verifyHuman).mockResolvedValue(false);
    const caller = createCaller({ db: {} as never, userId: null, clientIp: "198.51.100.1" });

    await expect(
      caller.bids.place({
        auctionId: "00000000-0000-4000-8000-000000000000",
        bidderName: "Bot",
        bidderEmail: "victim@example.com",
        amount: 5000,
        turnstileToken: "forged",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(verifyHuman).toHaveBeenCalledWith("forged", "198.51.100.1");
  });
});

describe("bids router privacy", () => {
  it("exposes no public way to read bids, which hold bidder emails and IPs", () => {
    const procedures = Object.keys(bidsRouter._def.procedures);
    expect(procedures).toEqual(["place"]);
  });
});
