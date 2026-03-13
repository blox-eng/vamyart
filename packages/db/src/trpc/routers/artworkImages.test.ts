import { describe, it, expect } from "vitest";
import { validateImageInput } from "./artworkImages";

describe("artworkImages router", () => {
  describe("validateImageInput", () => {
    it("rejects files over 10MB", () => {
      const input = { fileBase64: "data:image/jpeg;base64," + "x".repeat(14_000_000), fileName: "test.jpg", artworkId: "uuid" };
      expect(() => validateImageInput(input)).toThrow("File too large");
    });

    it("rejects invalid MIME types", () => {
      const input = { fileBase64: "data:image/gif;base64,R0lGOD", fileName: "test.gif", artworkId: "uuid" };
      expect(() => validateImageInput(input)).toThrow("Invalid file type");
    });

    it("accepts valid jpeg", () => {
      const input = { fileBase64: "data:image/jpeg;base64,/9j/4AAQ", fileName: "test.jpg", artworkId: "uuid" };
      expect(() => validateImageInput(input)).not.toThrow();
    });

    it("accepts valid png", () => {
      const input = { fileBase64: "data:image/png;base64,iVBOR", fileName: "test.png", artworkId: "uuid" };
      expect(() => validateImageInput(input)).not.toThrow();
    });

    it("accepts valid webp", () => {
      const input = { fileBase64: "data:image/webp;base64,UklGR", fileName: "test.webp", artworkId: "uuid" };
      expect(() => validateImageInput(input)).not.toThrow();
    });

    it("rejects missing data URI prefix", () => {
      const input = { fileBase64: "just-some-text", fileName: "test.jpg", artworkId: "uuid" };
      expect(() => validateImageInput(input)).toThrow("Invalid file format");
    });
  });
});
