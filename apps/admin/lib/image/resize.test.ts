import { describe, it, expect } from "vitest";
import { computeTargetDimensions, planOutput, toGrayscale } from "./resize";

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

describe("planOutput", () => {
  it("uploads the original when there is nothing to trim or shrink", () => {
    expect(planOutput(2000, 1500, null, 2560)).toBeNull();
  });

  it("downscales an untrimmed image past the cap", () => {
    expect(planOutput(4000, 2000, null, 2560)).toEqual({
      source: { left: 0, top: 0, width: 4000, height: 2000 },
      width: 2560,
      height: 1280,
    });
  });

  it("re-encodes a trimmed image even when it is within the cap", () => {
    const crop = { left: 100, top: 150, width: 1200, height: 900 };
    expect(planOutput(1600, 1600, crop, 2560)).toEqual({ source: crop, width: 1200, height: 900 });
  });

  it("caps the trimmed region, not the whole photo", () => {
    const crop = { left: 500, top: 800, width: 3000, height: 2400 };
    expect(planOutput(4000, 4000, crop, 2560)).toEqual({ source: crop, width: 2560, height: 2048 });
  });
});

describe("toGrayscale", () => {
  it("collapses RGBA to luma", () => {
    const rgba = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255, 255, 0, 0, 255]);
    expect(Array.from(toGrayscale(rgba))).toEqual([255, 0, 76]);
  });
});
