import { describe, it, expect } from "vitest";
import { slugify, artworkDeleteBlockReason } from "./artworks";

describe("slugify", () => {
  it("lowercases and hyphenates words", () => {
    expect(slugify("On the Horizon")).toBe("on-the-horizon");
  });

  it("strips punctuation and apostrophes", () => {
    expect(slugify("Maeve's First Contact!")).toBe("maeves-first-contact");
  });

  it("collapses repeated separators and trims them", () => {
    expect(slugify("  Whispers   &   Echoes  ")).toBe("whispers-echoes");
  });

  it("transliterates common accents", () => {
    expect(slugify("Café Bleu")).toBe("cafe-bleu");
  });

  it("returns empty string for input with no usable characters", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("artworkDeleteBlockReason", () => {
  it("returns null when no orders and no blocking auction", () => {
    expect(artworkDeleteBlockReason({ orderCount: 0, auctionStatuses: [] })).toBeNull();
  });

  it("blocks when an order exists", () => {
    expect(artworkDeleteBlockReason({ orderCount: 2, auctionStatuses: [] })).toMatch(/order/i);
  });

  it("blocks when an active auction exists", () => {
    expect(artworkDeleteBlockReason({ orderCount: 0, auctionStatuses: ["active"] })).toMatch(/auction/i);
  });

  it("allows deletion when only closed/cancelled auctions exist", () => {
    expect(artworkDeleteBlockReason({ orderCount: 0, auctionStatuses: ["closed", "cancelled"] })).toBeNull();
  });
});
