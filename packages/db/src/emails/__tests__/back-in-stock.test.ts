import { describe, it, expect } from "vitest";
import { renderBackInStockHtml } from "../back-in-stock";

describe("renderBackInStockHtml", () => {
  it("includes piece name, variant name, and deep link", () => {
    const html = renderBackInStockHtml({
      pieceName: "Blue Harbour",
      variantName: "Original, 40×50cm",
      pieceUrl: "https://vamy.art/get-a-piece/blue-harbour/",
      termsUrl: "https://vamy.art/terms",
      privacyUrl: "https://vamy.art/privacy",
    });
    expect(html).toContain("Blue Harbour");
    expect(html).toContain("Original, 40×50cm");
    expect(html).toContain("https://vamy.art/get-a-piece/blue-harbour/");
    expect(html).toContain("one-time");
  });

  it("escapes untrusted input", () => {
    const html = renderBackInStockHtml({
      pieceName: "<script>alert(1)</script>",
      variantName: "A",
      pieceUrl: "https://vamy.art/x/",
      termsUrl: "https://vamy.art/terms",
      privacyUrl: "https://vamy.art/privacy",
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
