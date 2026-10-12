import { describe, it, expect } from "vitest";
import {
  publicFilters,
  allOrder,
  landingOrder,
  aspectOf,
  pieceAltText,
  type OrderCollection,
  type OrderPiece,
} from "./gallery";

const piece = (id: string, o: Partial<OrderPiece> = {}): OrderPiece => ({
  id,
  published: true,
  deleted: false,
  sortOrder: 0,
  title: id,
  ...o,
});
const col = (id: string, pieceIds: string[], o: Partial<OrderCollection> = {}): OrderCollection => ({
  id,
  slug: id,
  title: id,
  published: true,
  deleted: false,
  onLanding: true,
  sortOrder: 0,
  pieceIds,
  ...o,
});

describe("publicFilters", () => {
  it("excludes a published collection whose only piece is unpublished, and excludes drafts", () => {
    const pieces = [piece("a", { published: false }), piece("b")];
    const cols = [col("empty", ["a"]), col("draft", ["b"], { published: false }), col("ok", ["b"])];
    expect(publicFilters(cols, pieces)).toEqual([{ slug: "ok", title: "ok" }]);
  });
});

describe("allOrder", () => {
  it("lists a piece in two collections once, at its first position", () => {
    const pieces = [piece("p1"), piece("p2")];
    const cols = [col("selected", ["p2", "p1"], { sortOrder: 1 }), col("oil", ["p1"], { sortOrder: 0 })];
    expect(allOrder(cols, pieces)).toEqual(["p1", "p2"]);
  });

  it("appends unassigned and draft-only pieces by sortOrder then title", () => {
    const pieces = [
      piece("in"),
      piece("loose-b", { title: "B", sortOrder: 1 }),
      piece("loose-a", { title: "A", sortOrder: 1 }),
      piece("draft-only", { title: "Z", sortOrder: 0 }),
    ];
    const cols = [col("c", ["in"]), col("d", ["draft-only"], { published: false })];
    expect(allOrder(cols, pieces)).toEqual(["in", "draft-only", "loose-a", "loose-b"]);
  });
});

describe("landingOrder", () => {
  const pieces = [piece("a"), piece("b")];
  it("skips a collection with onLanding false", () => {
    const cols = [col("on", ["a"]), col("off", ["b"], { onLanding: false })];
    expect(landingOrder(cols, pieces)).toEqual(["a"]);
  });
  it("returns [] when no collection is on", () => {
    expect(landingOrder([col("off", ["a"], { onLanding: false })], pieces)).toEqual([]);
  });
});

describe("aspectOf", () => {
  it("is width over height", () => {
    expect(aspectOf({ width: 1200, height: 800 })).toBe(1.5);
  });
  it("falls back to 0.8 when unknown or invalid", () => {
    expect(aspectOf({ width: null, height: 800 })).toBe(0.8);
    expect(aspectOf({ width: 0, height: 0 })).toBe(0.8);
  });
});

describe("pieceAltText", () => {
  it("generates from title and medium", () => {
    expect(pieceAltText({ altText: null, title: "Silence", medium: "Oil on canvas" })).toBe(
      "Silence, Oil on canvas, by Maeve Vamy"
    );
  });
  it("omits a missing medium", () => {
    expect(pieceAltText({ altText: null, title: "Silence", medium: null })).toBe("Silence, by Maeve Vamy");
  });
  it("falls back when altText is blank", () => {
    expect(pieceAltText({ altText: "  ", title: "Silence", medium: null })).toBe("Silence, by Maeve Vamy");
  });
  it("returns custom altText trimmed", () => {
    expect(pieceAltText({ altText: "  A quiet room ", title: "Silence", medium: null })).toBe("A quiet room");
  });
});
