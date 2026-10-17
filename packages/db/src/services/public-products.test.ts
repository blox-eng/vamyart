import { describe, it, expect } from "vitest";
import { publicProducts } from "./public-products";

const v = (id: string, available = true) => ({ id, available });
const p = (id: string, active: boolean, variants: ReturnType<typeof v>[]) => ({ id, active, variants });

describe("publicProducts", () => {
  it("drops inactive products", () => {
    expect(publicProducts([p("a", false, [v("1")])])).toEqual([]);
  });
  it("drops unavailable variants", () => {
    expect(publicProducts([p("a", true, [v("1"), v("2", false)])])[0].variants.map((x) => x.id)).toEqual(["1"]);
  });
  it("drops products left with no variants", () => {
    expect(publicProducts([p("a", true, [v("1", false)])])).toEqual([]);
  });
  it("keeps order", () => {
    expect(publicProducts([p("b", true, [v("1")]), p("a", true, [v("2")])]).map((x) => x.id)).toEqual(["b", "a"]);
  });
});
