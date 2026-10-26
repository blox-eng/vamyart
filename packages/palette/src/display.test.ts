import { describe, it, expect } from "vitest";
import { splashShape, recipeText, isPale } from "./display";
import { solveRecipe, mixParts } from "./mix";
import type { Paint, Recipe } from "./types";

const paints: Paint[] = [
  { id: "w", brand: "Test", name: "Titanium White", hex: "#f4f4f0", pigments: ["PW6"] },
  { id: "u", brand: "Test", name: "Ultramarine Blue", hex: "#1b2a7a", pigments: ["PB29"] },
];

const part = (name: string, parts: number) => ({ paintId: name, name, pigments: [], parts });

describe("splashShape", () => {
  it("is stable for the same seed and differs between seeds", () => {
    expect(splashShape("#1b2a7a", 20)).toEqual(splashShape("#1b2a7a", 20));
    expect(splashShape("#1b2a7a", 20).d).not.toBe(splashShape("#7a3b1e", 20).d);
  });

  it("draws a closed knife smear inside its box", () => {
    const { width, height, d } = splashShape("#abcdef", 20);
    expect([width, height]).toEqual([48, 26]);
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    expect(Math.min(...nums)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...nums)).toBeLessThanOrEqual(width);
  });
});

describe("recipeText", () => {
  it("reads in painter's words, largest first", () => {
    const target = mixParts([[paints[1], 1], [paints[0], 3]]);
    expect(recipeText(solveRecipe(target, paints)!)).toBe("3 parts Titanium White and 1 part Ultramarine Blue");
  });

  it("calls a small share a touch", () => {
    const recipe: Recipe = { hex: "#000000", deltaE: 0, parts: [part("Titanium White", 8), part("Yellow Ochre", 3), part("Ivory Black", 1)] };
    expect(recipeText(recipe)).toBe("8 parts Titanium White, 3 parts Yellow Ochre and a touch of Ivory Black");
  });

  it("says when a colour comes straight from the tube", () => {
    expect(recipeText({ hex: "#000000", deltaE: 0, parts: [part("Ivory Black", 1)] })).toBe("Ivory Black, straight from the tube");
  });
});

describe("isPale", () => {
  it("flags colours that would vanish on a white wall", () => {
    expect(isPale("#f1efe8")).toBe(true);
    expect(isPale("#c7c7c2")).toBe(false);
    expect(isPale("#151310")).toBe(false);
  });
});
