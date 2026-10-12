import { describe, it, expect } from "vitest";
import { findContentBox, scaleContentBox } from "./content-box";

function canvas(width: number, height: number, fill: number): Uint8Array {
  return new Uint8Array(width * height).fill(fill);
}

function rect(gray: Uint8Array, width: number, x0: number, y0: number, w: number, h: number, value: number) {
  for (let y = y0; y < y0 + h; y++) gray.fill(value, y * width + x0, y * width + x0 + w);
}

describe("findContentBox", () => {
  it("finds a dark painting on white exactly", () => {
    const gray = canvas(100, 100, 255);
    rect(gray, 100, 20, 30, 60, 40, 40);
    expect(findContentBox(gray, 100, 100)).toEqual({ left: 20, top: 30, width: 60, height: 40 });
  });

  it("excludes a soft drop shadow on the right and bottom", () => {
    const gray = canvas(100, 100, 255);
    // Linear shadow fading 200 -> 255 over 6px, offset like a real drop shadow.
    for (let d = 0; d < 6; d++) {
      const value = 200 + Math.round((55 * d) / 6);
      rect(gray, 100, 80 + d, 33, 1, 40, value);
      rect(gray, 100, 23, 70 + d, 60, 1, value);
    }
    rect(gray, 100, 20, 30, 60, 40, 40);
    expect(findContentBox(gray, 100, 100)).toEqual({ left: 20, top: 30, width: 60, height: 40 });
  });

  it("settles past a blurred edge pixel", () => {
    const gray = canvas(100, 100, 255);
    rect(gray, 100, 19, 29, 62, 42, 150);
    rect(gray, 100, 20, 30, 60, 40, 40);
    expect(findContentBox(gray, 100, 100)).toEqual({ left: 20, top: 30, width: 60, height: 40 });
  });

  it("leaves an already tight image alone", () => {
    const gray = canvas(100, 100, 90);
    rect(gray, 100, 30, 30, 40, 40, 160);
    expect(findContentBox(gray, 100, 100)).toBeNull();
  });

  it("leaves a photo on a non-white background alone", () => {
    const gray = canvas(100, 100, 150);
    rect(gray, 100, 20, 30, 60, 40, 40);
    expect(findContentBox(gray, 100, 100)).toBeNull();
  });

  it("does not trim noise", () => {
    let seed = 7;
    const gray = new Uint8Array(100 * 100).map(() => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % 256;
    });
    expect(findContentBox(gray, 100, 100)).toBeNull();
  });

  it("refuses a crop that would drop more than 80% of the image", () => {
    const gray = canvas(100, 100, 255);
    rect(gray, 100, 35, 35, 30, 30, 40);
    expect(findContentBox(gray, 100, 100)).toBeNull();
  });

  it("returns null for tiny, empty or short buffers", () => {
    expect(findContentBox(new Uint8Array(0), 0, 0)).toBeNull();
    expect(findContentBox(canvas(4, 4, 255), 4, 4)).toBeNull();
    expect(findContentBox(canvas(10, 10, 255), 100, 100)).toBeNull();
  });

  it("returns null for a blank white image", () => {
    expect(findContentBox(canvas(100, 100, 255), 100, 100)).toBeNull();
  });
});

describe("scaleContentBox", () => {
  it("maps a box onto the full-size image, rounding inward", () => {
    expect(scaleContentBox({ left: 20, top: 30, width: 60, height: 40 }, 100, 100, 320, 320)).toEqual({
      left: 64,
      top: 96,
      width: 192,
      height: 128,
    });
    expect(scaleContentBox({ left: 1, top: 1, width: 1, height: 1 }, 3, 3, 10, 10)).toEqual({
      left: 4,
      top: 4,
      width: 2,
      height: 2,
    });
  });
});
