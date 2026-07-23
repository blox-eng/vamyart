import { describe, expect, it } from "vitest";
import { variantDeleteBlockReason } from "./products";

describe("variantDeleteBlockReason", () => {
  it("blocks deletion when the variant has orders", () => {
    expect(variantDeleteBlockReason({ orderCount: 2, auctionCount: 0 })).toBe(
      "This variant has orders and cannot be deleted. Mark it unavailable instead."
    );
  });

  it("blocks deletion when the variant is linked to an auction", () => {
    expect(variantDeleteBlockReason({ orderCount: 0, auctionCount: 1 })).toBe(
      "This variant is linked to an auction and cannot be deleted."
    );
  });

  it("prioritizes the order message when both block", () => {
    expect(variantDeleteBlockReason({ orderCount: 1, auctionCount: 1 })).toBe(
      "This variant has orders and cannot be deleted. Mark it unavailable instead."
    );
  });

  it("blocks deletion when the variant has issued certificates", () => {
    expect(
      variantDeleteBlockReason({ orderCount: 0, auctionCount: 0, certificateCount: 1 })
    ).toBe("This variant has issued certificates and cannot be deleted.");
  });

  it("prioritizes the order message over certificates", () => {
    expect(
      variantDeleteBlockReason({ orderCount: 1, auctionCount: 0, certificateCount: 3 })
    ).toBe("This variant has orders and cannot be deleted. Mark it unavailable instead.");
  });

  it("allows deletion when nothing references the variant", () => {
    expect(
      variantDeleteBlockReason({ orderCount: 0, auctionCount: 0, certificateCount: 0 })
    ).toBeNull();
  });
});
