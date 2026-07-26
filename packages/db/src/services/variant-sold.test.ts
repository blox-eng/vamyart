import { describe, expect, it } from "vitest";
import { isVariantSold, shouldAutoMarkSold } from "./variant-sold";

describe("isVariantSold", () => {
  it("is sold when soldAt is set, regardless of stock", () => {
    expect(isVariantSold({ isOriginal: false, soldAt: new Date(), stockQuantity: 5 })).toBe(true);
  });
  it("is sold when an original is out of stock", () => {
    expect(isVariantSold({ isOriginal: true, soldAt: null, stockQuantity: 0 })).toBe(true);
  });
  it("is NOT sold for a non-original edition that is out of stock", () => {
    expect(isVariantSold({ isOriginal: false, soldAt: null, stockQuantity: 0 })).toBe(false);
  });
  it("is NOT sold for an in-stock original", () => {
    expect(isVariantSold({ isOriginal: true, soldAt: null, stockQuantity: 1 })).toBe(false);
  });
  it("is NOT sold for a normal for-sale variant", () => {
    expect(isVariantSold({ isOriginal: false, soldAt: null, stockQuantity: 3 })).toBe(false);
  });
});

describe("shouldAutoMarkSold", () => {
  it("marks an original that just went out of stock and is not yet flagged", () => {
    expect(shouldAutoMarkSold({ isOriginal: true, soldAt: null, stockQuantity: 0 })).toBe(true);
  });
  it("does not re-mark an original already flagged sold", () => {
    expect(shouldAutoMarkSold({ isOriginal: true, soldAt: new Date(), stockQuantity: 0 })).toBe(false);
  });
  it("does not mark a non-original edition that ran out", () => {
    expect(shouldAutoMarkSold({ isOriginal: false, soldAt: null, stockQuantity: 0 })).toBe(false);
  });
  it("does not mark an original that still has stock", () => {
    expect(shouldAutoMarkSold({ isOriginal: true, soldAt: null, stockQuantity: 2 })).toBe(false);
  });
});
