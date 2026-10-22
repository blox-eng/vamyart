export type Paint = {
  id: string;
  brand: string;
  name: string;
  hex: string;
  pigments: string[];
};

export type RecipePart = {
  paintId: string;
  name: string;
  pigments: string[];
  parts: number;
};

export type Recipe = {
  parts: RecipePart[];
  hex: string;
  deltaE: number;
};

export type Swatch = {
  hex: string;
  name: string;
  area: number;
  recipe: Recipe | null;
};

export type Palette = { swatches: Swatch[] };
