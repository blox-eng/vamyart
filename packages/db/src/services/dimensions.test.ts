import { describe, it, expect } from "vitest";
import { parseDimensionsCm } from "./dimensions";

describe("parseDimensionsCm", () => {
  it("reads a landscape '60x40 cm'", () => {
    expect(parseDimensionsCm("60x40 cm", "landscape")).toEqual({ widthCm: 60, heightCm: 40 });
  });
  it("puts the larger side vertical for a portrait without a unit", () => {
    expect(parseDimensionsCm("46 x 38", "portrait")).toEqual({ widthCm: 38, heightCm: 46 });
  });
  it("accepts the × sign", () => {
    expect(parseDimensionsCm("90 × 70 cm", "landscape")).toEqual({ widthCm: 90, heightCm: 70 });
  });
  it("orients '100x70' as portrait", () => {
    expect(parseDimensionsCm("100x70", "portrait")).toEqual({ widthCm: 70, heightCm: 100 });
  });
  it("rejects free text", () => {
    expect(parseDimensionsCm("approx. 1m", "landscape")).toBeNull();
  });
  it("rejects other units", () => {
    expect(parseDimensionsCm("46 x 38 in", "portrait")).toBeNull();
  });
  it("returns null without text", () => {
    expect(parseDimensionsCm(null, "portrait")).toBeNull();
  });
  it("never guesses without an orientation", () => {
    expect(parseDimensionsCm("60x40 cm", null)).toBeNull();
  });
  it("needs equal sides for a square image", () => {
    expect(parseDimensionsCm("50 x 50 cm", "square")).toEqual({ widthCm: 50, heightCm: 50 });
    expect(parseDimensionsCm("50 x 40 cm", "square")).toBeNull();
  });
});
