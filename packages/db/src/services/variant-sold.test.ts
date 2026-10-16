import { describe, expect, it } from "vitest";
import { isPieceSold, isVariantSold, pieceSoldAt, shouldAutoMarkSold } from "./variant-sold";

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

describe("isPieceSold", () => {
  const original = { isOriginal: true, soldAt: null, stockQuantity: 1 };
  const print = { isOriginal: false, soldAt: null, stockQuantity: 10 };

  it("is sold when its original is sold, even if prints remain", () => {
    expect(isPieceSold("available", [{ ...original, soldAt: new Date() }, print])).toBe(true);
  });
  it("is sold when the studio marks the piece sold without any variants", () => {
    expect(isPieceSold("sold", [])).toBe(true);
  });
  it("is NOT sold while the original is still for sale", () => {
    expect(isPieceSold("available", [original, print])).toBe(false);
  });
  it("is NOT sold when only a print edition is flagged sold", () => {
    expect(isPieceSold("available", [original, { ...print, soldAt: new Date() }])).toBe(false);
  });
});

describe("pieceSoldAt", () => {
  it("is when the original sold, ignoring print editions", () => {
    const at = pieceSoldAt([
      { isOriginal: true, soldAt: "2026-03-14T10:00:00Z", stockQuantity: 0 },
      { isOriginal: false, soldAt: "2026-09-01T10:00:00Z", stockQuantity: 0 },
    ]);
    expect(at?.toISOString()).toBe("2026-03-14T10:00:00.000Z");
  });
  it("is unknown when the original has no recorded sale date", () => {
    expect(pieceSoldAt([{ isOriginal: true, soldAt: null, stockQuantity: 0 }])).toBeNull();
    expect(pieceSoldAt([])).toBeNull();
  });
});
