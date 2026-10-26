import { describe, it, expect } from "vitest";
import { measure, describeMeasurements } from "./measure";

// A width × height image painted by a function of (x, y) → hex.
function paint(width: number, height: number, at: (x: number, y: number) => string): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const hex = at(x, y);
      rgba.set([1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).concat(255), (y * width + x) * 4);
    }
  return rgba;
}

// Pale sky over dark land, the horizon inside the middle band, an orange
// patch at the bottom right.
const landscape = paint(30, 30, (x, y) => (y < 14 ? "#e6e6e6" : x >= 24 && y >= 24 ? "#d9601c" : "#202020"));

describe("measure", () => {
  const m = measure(landscape, 30);

  it("maps where the lights and darks sit", () => {
    expect(m.value.grid[0]).toEqual([92, 92, 92, 92, 92]);
    expect(m.value.grid[4][0]).toBe(24);
    expect(m.value.shares[0]).toBeGreaterThan(0.4);
    expect(m.value.shares[2]).toBeGreaterThan(0.4);
  });

  it("finds the strongest contrast at the horizon", () => {
    expect(m.value.contrastAt).toBe("middle left");
  });

  it("finds where colour concentrates and that it is warm", () => {
    expect(m.chroma.strongestAt).toBe("bottom right");
    expect(m.temperature.warmShare).toBe(1);
  });

  it("counts faint tints, so a cool grey reads as cool", () => {
    const t = measure(paint(30, 30, (x) => (x < 10 ? "#7d8a8f" : "#8a8580")), 30);
    expect(t.chroma.neutralShare).toBe(1);
    expect(t.temperature.warmShare).toBeCloseTo(2 / 3, 1);
    expect(t.temperature.coolestAt).toMatch(/left$/);
  });

  it("does not name a colour area in a grey picture", () => {
    const grey = measure(paint(9, 9, (x) => (x < 4 ? "#333333" : "#cccccc")), 9);
    expect(grey.chroma.strongestAt).toBeNull();
    expect(grey.temperature.warmShare).toBeNull();
    expect(grey.temperature.lightsVsDarks).toBe("same");
  });
});

describe("describeMeasurements", () => {
  it("states the measurements in plain words", () => {
    const text = describeMeasurements(measure(landscape, 30));
    expect(text).toContain("Value map, mean lightness in a 5×5 grid, rows top to bottom: 92 92 92 92 92 /");
    expect(text).toContain("Strongest value contrast: middle left.");
    expect(text).toContain("Colour concentrates at the bottom right.");
    expect(text).toContain("100% leans warm");
  });
});
