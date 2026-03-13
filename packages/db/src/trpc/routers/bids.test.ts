import { describe, it, expect, vi } from "vitest";

vi.mock("../../client", () => ({ db: {} }));
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: vi.fn() },
  })),
}));

import { validateBid } from "./bids";

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
