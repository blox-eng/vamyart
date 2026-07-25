import { describe, it, expect } from "vitest";
import { computeOutputSize } from "./crop";

describe("computeOutputSize", () => {
  it("leaves a crop within the cap unscaled", () => {
    expect(computeOutputSize({ x: 0, y: 0, width: 1500, height: 1000 })).toEqual({ width: 1500, height: 1000 });
  });

  it("caps the long edge at 2560 while preserving the 3:2 ratio", () => {
    expect(computeOutputSize({ x: 0, y: 0, width: 6000, height: 4000 })).toEqual({ width: 2560, height: 1707 });
  });

  it("honors a custom max edge", () => {
    expect(computeOutputSize({ x: 0, y: 0, width: 3000, height: 2000 }, 1500)).toEqual({ width: 1500, height: 1000 });
  });
});
