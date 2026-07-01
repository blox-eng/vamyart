import { describe, it, expect } from "vitest";
import { extForContentType } from "./artworkImages";

describe("artworkImages router", () => {
  describe("extForContentType", () => {
    it("maps jpeg to jpg", () => {
      expect(extForContentType("image/jpeg")).toBe("jpg");
    });

    it("maps png to png", () => {
      expect(extForContentType("image/png")).toBe("png");
    });

    it("maps webp to webp", () => {
      expect(extForContentType("image/webp")).toBe("webp");
    });

    // The storage key derives the extension from the validated content type,
    // never an untrusted client filename (which could carry unicode / unsafe
    // chars that Supabase rejects). Anything outside the allow-list throws.
    it("rejects disallowed types", () => {
      expect(() => extForContentType("image/gif")).toThrow("Invalid file type");
      expect(() => extForContentType("image/svg+xml")).toThrow("Invalid file type");
      expect(() => extForContentType("application/pdf")).toThrow("Invalid file type");
      expect(() => extForContentType("")).toThrow("Invalid file type");
    });
  });
});
