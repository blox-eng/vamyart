import { describe, it, expect, vi, beforeEach } from "vitest";

// Every public procedure that can carry an artwork row, with a saved palette on it.
const palette = {
  swatches: [{
    hex: "#1f2b7a",
    name: "night blue",
    area: 1,
    recipe: { hex: "#1f2b7a", deltaE: 0.4, parts: [{ paintId: "6f1c0000-0000-0000-0000-000000000000", name: "Ultramarine Blue", pigments: ["PB29"], parts: 3 }] },
  }],
};
const artwork = {
  id: "a1",
  slug: "night",
  title: "Night",
  published: true,
  deletedAt: null,
  palette,
  showPalette: false,
  images: [],
  product: [],
  auction: null,
  updatedAt: new Date("2026-10-01"),
};

const writes: Record<string, unknown>[] = [];

vi.mock("../../client", () => ({
  db: {
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: () => ({ returning: async () => (writes.push(values), [{ ...artwork, ...values }]) }),
      }),
    }),
    query: {
      artworks: { findFirst: vi.fn(async () => artwork) },
      products: { findFirst: vi.fn(async (args: { with?: { artwork?: boolean } }) => ({ id: "p1", active: true, featured: true, variants: [], ...(args?.with?.artwork ? { artwork } : {}) })) },
    },
  },
}));

import { createCaller } from "../root";

const visitor = createCaller({ db: {} as never, userId: null });
const artist = createCaller({ db: {} as never, userId: "artist" });

beforeEach(() => {
  artwork.showPalette = false;
  writes.length = 0;
});

describe("a hidden palette never leaves the server", () => {
  it.each([
    ["artworks.getBySlug", () => visitor.artworks.getBySlug({ slug: "night" })],
    ["products.getFeatured", () => visitor.products.getFeatured()],
    ["products.getByArtworkSlug", () => visitor.products.getByArtworkSlug({ slug: "night" })],
  ])("%s", async (_, call) => {
    const json = JSON.stringify(await call());
    expect(json).not.toContain("#1f2b7a");
    expect(json).not.toContain("showPalette");
  });
});

describe("a shown palette goes out in its public shape", () => {
  it("drops studio internals: paint ids and ΔE", async () => {
    artwork.showPalette = true;
    const piece = await visitor.artworks.getBySlug({ slug: "night" });
    expect(piece?.palette).toEqual({
      swatches: [{ hex: "#1f2b7a", name: "night blue", area: 1, recipe: { parts: [{ name: "Ultramarine Blue", pigments: ["PB29"], parts: 3 }] } }],
    });
  });

  it("serves nothing rather than a malformed stored palette", async () => {
    artwork.showPalette = true;
    (artwork as { palette: unknown }).palette = { swatches: "oops" };
    expect((await visitor.artworks.getBySlug({ slug: "night" }))?.palette).toBeNull();
    (artwork as { palette: unknown }).palette = palette;
  });

  it("drops recipe parts that aren't parts instead of failing the page", async () => {
    artwork.showPalette = true;
    (artwork as { palette: unknown }).palette = { swatches: [{ hex: "#1f2b7a", name: "x", area: 1, recipe: { parts: [null, { name: 7 }] } }] };
    const piece = await visitor.artworks.getBySlug({ slug: "night" });
    expect(piece?.palette?.swatches[0].recipe).toBeNull();
    (artwork as { palette: unknown }).palette = palette;
  });
});

describe("the studio hides a palette without replacing it", () => {
  it("artworks.update changes only the visibility", async () => {
    await artist.artworks.update({ id: "00000000-0000-4000-8000-000000000001", showPalette: false });
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ showPalette: false });
    expect(writes[0]).not.toHaveProperty("palette");
  });
});
