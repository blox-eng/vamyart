import { describe, it, expect } from "vitest";
import { collectionRevalidatePaths, pieceRevalidatePaths } from "./revalidate-paths";

describe("collectionRevalidatePaths", () => {
  it("covers home, gallery and every collection page", () => {
    expect(collectionRevalidatePaths(["oil", "photography"])).toEqual([
      "/",
      "/gallery/",
      "/gallery/collections/oil/",
      "/gallery/collections/photography/",
    ]);
  });

  it("works with no collections", () => {
    expect(collectionRevalidatePaths([])).toEqual(["/", "/gallery/"]);
  });
});

describe("pieceRevalidatePaths", () => {
  it("adds the piece page after home, gallery and collection pages", () => {
    expect(pieceRevalidatePaths("blue-hour", ["oil"])).toEqual([
      "/",
      "/gallery/",
      "/gallery/collections/oil/",
      "/gallery/blue-hour/",
    ]);
  });

  it("omits the piece page for whole-gallery operations", () => {
    expect(pieceRevalidatePaths(null, ["oil"])).toEqual(["/", "/gallery/", "/gallery/collections/oil/"]);
  });
});
