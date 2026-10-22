import { describe, it, expect } from "vitest";
import { splashPath } from "./splash";

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
