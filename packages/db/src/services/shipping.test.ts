import { describe, it, expect } from "vitest";
import { resolveShipping } from "./shipping";

const method = (type: string, cost: string | null, displayText = type) => ({ type, cost, displayText });

describe("resolveShipping", () => {
  it("reads a paid method's cost", () => {
    expect(resolveShipping(method("paid", "15.00", "Tracked"))).toEqual({ type: "paid", cost: 15, displayText: "Tracked" });
  });
  it("gives a free method no cost", () => {
    expect(resolveShipping(method("free", null, "Free shipping"))).toEqual({ type: "free", cost: null, displayText: "Free shipping" });
  });
  it("falls back to the default method", () => {
    expect(resolveShipping(null, method("free", null, "Free shipping")).type).toBe("free");
  });
  it("is arranged by the artist when nothing is set", () => {
    expect(resolveShipping(null, null)).toEqual({ type: "custom", cost: null, displayText: "Shipping arranged by artist" });
  });
});
