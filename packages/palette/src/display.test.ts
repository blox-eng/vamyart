import { describe, it, expect } from "vitest";
import { splashPath, recipeText } from "./display";
import { solveRecipe, mixParts } from "./mix";
import type { Paint } from "./types";

const paints: Paint[] = [
  { id: "w", brand: "Test", name: "Titanium White", hex: "#f4f4f0", pigments: ["PW6"] },
  { id: "u", brand: "Test", name: "Ultramarine Blue", hex: "#1b2a7a", pigments: ["PB29"] },
];

describe("splashPath", () => {
  it("is stable for the same seed and differs between seeds", () => {
    expect(splashPath("#1b2a7a", 20)).toBe(splashPath("#1b2a7a", 20));
    expect(splashPath("#1b2a7a", 20)).not.toBe(splashPath("#7a3b1e", 20));
  });

  it("draws a closed path inside the splash box", () => {
    const d = splashPath("#abcdef", 20);
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    expect(Math.max(...nums)).toBeLessThanOrEqual(40);
    expect(Math.min(...nums)).toBeGreaterThanOrEqual(0);
  });
});

describe("recipeText", () => {
  it("reads as tube parts, largest first", () => {
    const target = mixParts([[paints[1], 1], [paints[0], 3]]);
    expect(recipeText(solveRecipe(target, paints)!)).toBe("Titanium White 3 : Ultramarine Blue 1");
  });
});
