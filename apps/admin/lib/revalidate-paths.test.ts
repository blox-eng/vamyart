import { describe, it, expect } from "vitest";
import { collectionRevalidatePaths } from "./revalidate-paths";

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
