import { describe, it, expect } from "vitest";
import { pieceLabel } from "./piece-label";

const collections = [
  { id: "c1", title: "Oil on canvas" },
  { id: "c2", title: "Photography " },
];

describe("pieceLabel", () => {
  it("names the piece's collections after its title", () => {
    expect(pieceLabel("Construction", ["c2", "c1"], collections)).toBe("Construction · Oil on canvas, Photography");
  });

  it("flags a piece that is in no collection", () => {
    expect(pieceLabel("Never", [], collections)).toBe("Never · no collection");
  });

  it("ignores ids of collections that no longer exist", () => {
    expect(pieceLabel("Silence", ["gone", "c1"], collections)).toBe("Silence · Oil on canvas");
  });
});
