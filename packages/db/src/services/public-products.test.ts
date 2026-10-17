import { describe, it, expect } from "vitest";
import { publicProducts } from "./public-products";

const v = (id: string, available = true) => ({ id, available, isOriginal: false, soldAt: null, stockQuantity: 1, price: "10" });
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
  it("hides the price of a sold variant", () => {
    const sold = { id: "o", available: true, isOriginal: true, soldAt: new Date(), stockQuantity: 0, price: "4321" };
    const print = { id: "a4", available: true, isOriginal: false, soldAt: null, stockQuantity: 3, price: "60" };
    const [prod] = publicProducts([{ id: "p", active: true, variants: [sold, print] }]);
    expect(prod.variants.map((x) => x.price)).toEqual([null, "60"]);
  });
  it("keeps order", () => {
    expect(publicProducts([p("b", true, [v("1")]), p("a", true, [v("2")])]).map((x) => x.id)).toEqual(["b", "a"]);
  });
});
