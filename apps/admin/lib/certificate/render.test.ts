import { describe, it, expect, beforeAll } from "vitest";
import { certificateImageUrl } from "./render";

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
});

describe("certificateImageUrl", () => {
  it("builds the public artwork-images URL from a storage path", () => {
    expect(certificateImageUrl("abc/whispers.jpg")).toBe(
      "https://example.supabase.co/storage/v1/object/public/artwork-images/abc/whispers.jpg",
    );
  });
  it("returns null when there is no image path", () => {
    expect(certificateImageUrl(null)).toBeNull();
  });
});
