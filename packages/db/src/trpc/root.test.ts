import { describe, it, expect } from "vitest";
import { appRouter } from "./root";

describe("appRouter", () => {
  it("offers no card checkout, because sales go by invoice and bank transfer (#63)", () => {
    const paths = Object.keys(appRouter._def.procedures);
    expect(paths.filter((p) => p.startsWith("checkout."))).toEqual([]);
    expect(paths.filter((p) => /createSession|stripe/i.test(p))).toEqual([]);
  });
});
