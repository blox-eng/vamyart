import { describe, expect, it } from "vitest";
import { seoHints } from "./seo-hints";

const filled = {
  altText: "Never, oil on canvas", seoDescription: "A study in blue.", excerpt: null,
  dimensions: "70 × 100 cm",
};

describe("seoHints", () => {
  it("is quiet when everything is filled in", () => {
    expect(seoHints(filled)).toEqual([]);
  });
  it("asks for alt text on the main photo", () => {
    expect(seoHints({ ...filled, altText: " " })).toEqual([
      "Add alt text so search engines and screen readers know what the painting shows.",
    ]);
  });
  it("skips alt text while the piece has no photo yet", () => {
    expect(seoHints({ ...filled, altText: undefined })).toEqual([]);
  });
  it("asks for a description only when there is neither an SEO description nor an excerpt", () => {
    expect(seoHints({ ...filled, seoDescription: null, excerpt: "Short." })).toEqual([]);
    expect(seoHints({ ...filled, seoDescription: "", excerpt: null })).toEqual(["Add a short description for search results."]);
  });
  it("asks for readable dimensions only when some are written", () => {
    expect(seoHints({ ...filled, dimensions: "about a metre" })).toEqual([
      "Write dimensions as width × height cm (e.g. 60 × 40 cm) so they show up in search.",
    ]);
    expect(seoHints({ ...filled, dimensions: null })).toEqual([]);
  });
});
