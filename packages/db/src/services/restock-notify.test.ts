import { describe, it, expect } from "vitest";
import { detectRestockTransition } from "./restock-notify";

describe("detectRestockTransition", () => {
  it("returns true only when moving from out-of-stock to in-stock", () => {
    expect(detectRestockTransition(
      { available: false, stockQuantity: 0 },
      { available: true,  stockQuantity: 1 },
    )).toBe(true);

    expect(detectRestockTransition(
      { available: true,  stockQuantity: 0 },
      { available: true,  stockQuantity: 5 },
    )).toBe(true);

    // already in stock
    expect(detectRestockTransition(
      { available: true,  stockQuantity: 3 },
      { available: true,  stockQuantity: 5 },
    )).toBe(false);

    // going out of stock
    expect(detectRestockTransition(
      { available: true,  stockQuantity: 3 },
      { available: true,  stockQuantity: 0 },
    )).toBe(false);

    // still out of stock
    expect(detectRestockTransition(
      { available: false, stockQuantity: 0 },
      { available: true,  stockQuantity: 0 },
    )).toBe(false);
  });
});
