import { describe, it, expect } from "vitest";
import { collectionCoverUrl } from "./collections";

const BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/artwork-images`;

describe("collectionCoverUrl", () => {
  it("builds a URL from the explicit cover path", () => {
    expect(collectionCoverUrl("covers/a.jpg", "pieces/b.jpg")).toBe(`${BASE}/covers/a.jpg`);
  });
  it("falls back to the first piece image when no cover set", () => {
    expect(collectionCoverUrl(null, "pieces/b.jpg")).toBe(`${BASE}/pieces/b.jpg`);
  });
  it("returns null when neither is available", () => {
    expect(collectionCoverUrl(null, null)).toBeNull();
  });
});
