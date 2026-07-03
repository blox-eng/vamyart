import { describe, it, expect } from "vitest";
import { computeTargetDimensions } from "./resize";

describe("computeTargetDimensions", () => {
  it("leaves images already within the cap untouched", () => {
    expect(computeTargetDimensions(2000, 1500, 2560)).toEqual({
      width: 2000,
      height: 1500,
      resized: false,
    });
  });

  it("treats an image exactly at the cap as no-op", () => {
    expect(computeTargetDimensions(2560, 1440, 2560)).toEqual({
      width: 2560,
      height: 1440,
      resized: false,
    });
  });

  it("scales a tall portrait so the long edge hits the cap", () => {
    // 4284x5712 (Maeve's phone export) -> long edge 5712 -> 2560
    expect(computeTargetDimensions(4284, 5712, 2560)).toEqual({
      width: 1920,
      height: 2560,
      resized: true,
    });
  });

  it("scales a wide landscape so the long edge hits the cap", () => {
    expect(computeTargetDimensions(4000, 2000, 2560)).toEqual({
      width: 2560,
      height: 1280,
      resized: true,
    });
  });

  it("scales a square image on both edges", () => {
    expect(computeTargetDimensions(4000, 4000, 2560)).toEqual({
      width: 2560,
      height: 2560,
      resized: true,
    });
  });

  it("never upscales a small image", () => {
    expect(computeTargetDimensions(800, 600, 2560)).toEqual({
      width: 800,
      height: 600,
      resized: false,
    });
  });
});
