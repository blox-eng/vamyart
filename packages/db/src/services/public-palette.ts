import type { Palette, PublicPalette, PublicSwatch, Recipe } from "@vamy/palette";

const HEX = /^#[0-9a-f]{6}$/;

// The palette as the public site may see it: null unless the artist chose to show
// it, and null rather than a malformed shape if the stored jsonb is off.
export function publicPalette(palette: Palette | null, show: boolean): PublicPalette | null {
  if (!show || !palette || !Array.isArray(palette.swatches)) return null;
  const swatches = palette.swatches.filter((s) => s && HEX.test(s.hex));
  if (swatches.length === 0) return null;
  return {
    swatches: swatches.map((s) => ({
      hex: s.hex,
      name: typeof s.name === "string" ? s.name : "",
      area: typeof s.area === "number" ? s.area : 0,
      recipe: publicRecipe(s.recipe),
    })),
  };
}

function publicRecipe(recipe: Recipe | null): PublicSwatch["recipe"] {
  const parts = (Array.isArray(recipe?.parts) ? recipe.parts : [])
    .filter((p) => p && typeof p.name === "string" && Array.isArray(p.pigments) && typeof p.parts === "number")
    .map(({ name, pigments, parts }) => ({ name, pigments, parts }));
  return parts.length ? { parts } : null;
}

// Artwork rows sent by public procedures carry no palette fields at all.
export function withoutPalette<T extends { palette?: unknown; showPalette?: unknown }>(artwork: T): Omit<T, "palette" | "showPalette"> {
  const { palette: _palette, showPalette: _show, ...rest } = artwork;
  return rest;
}
