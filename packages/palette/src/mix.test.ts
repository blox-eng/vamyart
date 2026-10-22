import { describe, it, expect } from "vitest";
import { solveRecipe, mixParts } from "./mix";
import type { Paint } from "./types";

const paints: Paint[] = [
  { id: "w", brand: "Test", name: "Titanium White", hex: "#f4f4f0", pigments: ["PW6"] },
  { id: "u", brand: "Test", name: "Ultramarine Blue", hex: "#1b2a7a", pigments: ["PB29"] },
  { id: "s", brand: "Test", name: "Burnt Sienna", hex: "#7a3b1e", pigments: ["PR101"] },
  { id: "y", brand: "Test", name: "Cadmium Yellow", hex: "#f2c400", pigments: ["PY35"] },
];

describe("solveRecipe", () => {
  it("returns a single tube when the target is that paint", () => {
    const r = solveRecipe("#1b2a7a", paints);
    expect(r?.parts.map((p) => p.paintId)).toEqual(["u"]);
    expect(r?.deltaE).toBeLessThan(0.5);
  });

  it("recovers a known two-paint mix", () => {
    const target = mixParts([[paints[1], 1], [paints[0], 3]]);
    const r = solveRecipe(target, paints)!;
    expect(r.parts.map((p) => p.paintId).sort()).toEqual(["u", "w"]);
    expect(r.parts.find((p) => p.paintId === "w")!.parts / r.parts.find((p) => p.paintId === "u")!.parts).toBe(3);
    expect(r.deltaE).toBeLessThan(1);
  });

  it("prefers fewer paints when an extra tube barely helps", () => {
    const target = mixParts([[paints[1], 1], [paints[0], 1]]);
    expect(solveRecipe(target, paints)!.parts).toHaveLength(2);
  });

  it("returns null with no paints to mix from", () => {
    expect(solveRecipe("#123456", [])).toBeNull();
  });
});
