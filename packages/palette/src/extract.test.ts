import { describe, it, expect } from "vitest";
import { extractPalette, whiteBalanceGains, applyGains, valueLevels } from "./extract";

function image(blocks: [string, number][]): Uint8ClampedArray {
  const total = blocks.reduce((n, [, count]) => n + count, 0);
  const rgba = new Uint8ClampedArray(total * 4);
  let p = 0;
  for (const [hex, count] of blocks) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    for (let i = 0; i < count; i++, p += 4) rgba.set([r, g, b, 255], p);
  }
  return rgba;
}

describe("extractPalette", () => {
  it("finds flat colour regions with their area share, largest first", () => {
    const rgba = image([["#1d3a8a", 600], ["#e8c547", 300], ["#7a2e1f", 100]]);
    const swatches = extractPalette(rgba, { k: 3 });
    expect(swatches.map((s) => s.hex)).toEqual(["#1d3a8a", "#e8c547", "#7a2e1f"]);
    expect(swatches.map((s) => Math.round(s.area * 100))).toEqual([60, 30, 10]);
  });

  it("is deterministic for the same pixels", () => {
    const rgba = image([["#335577", 400], ["#aa8844", 400], ["#dddddd", 200], ["#202020", 100]]);
    expect(extractPalette(rgba, { k: 4 })).toEqual(extractPalette(rgba, { k: 4 }));
  });

  it("merges clusters that are perceptually the same colour", () => {
    const rgba = image([["#808080", 500], ["#818181", 500]]);
    expect(extractPalette(rgba, { k: 2 })).toHaveLength(1);
  });

  it("keeps a small saturated accent as its own colour", () => {
    const rgba = image([["#808080", 600], ["#303030", 380], ["#d9601c", 20]]);
    const swatches = extractPalette(rgba, { k: 2 });
    const accent = swatches.find((s) => s.accent);
    expect(accent?.hex).toBe("#d9601c");
    expect(swatches.filter((s) => !s.accent).map((s) => s.hex)).toEqual(["#808080", "#303030"]);
  });

  it("drops the accent rule when asked", () => {
    const rgba = image([["#808080", 600], ["#303030", 380], ["#d9601c", 20]]);
    expect(extractPalette(rgba, { k: 2, keepAccent: false }).some((s) => s.accent)).toBe(false);
  });

  it("ignores transparent pixels", () => {
    const rgba = image([["#ff0000", 10]]);
    rgba[3] = 0;
    expect(extractPalette(rgba, { k: 2 })[0].area).toBe(1);
  });
});

describe("white balance", () => {
  it("makes the tapped reference neutral", () => {
    const gains = whiteBalanceGains([200, 180, 150]);
    const out = applyGains(new Uint8ClampedArray([200, 180, 150, 255]), gains);
    const [r, g, b] = out;
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(1);
  });
});

describe("valueLevels", () => {
  it("quantises lightness into equal bands", () => {
    expect(valueLevels([0, 0.2, 0.5, 0.8, 1], 3)).toEqual([0, 0, 1, 2, 2]);
  });
});
