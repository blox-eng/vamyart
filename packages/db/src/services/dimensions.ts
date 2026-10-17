export type Orientation = "landscape" | "portrait" | "square";

const DIMENSIONS = /^\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(?:cm)?\s*$/i;

// Free-text "60 × 40 cm" to centimetres. Which number is the width comes from
// the photo's orientation; without one (or with any other unit) we don't guess.
export function parseDimensionsCm(
  text: string | null,
  orientation: Orientation | null,
): { widthCm: number; heightCm: number } | null {
  const match = text && orientation ? DIMENSIONS.exec(text) : null;
  if (!match) return null;
  const [a, b] = [match[1], match[2]].map((n) => Number(n.replace(",", ".")));
  if (!(a > 0 && b > 0)) return null;
  const [long, short] = a >= b ? [a, b] : [b, a];
  if (orientation === "square") return a === b ? { widthCm: a, heightCm: b } : null;
  return orientation === "landscape" ? { widthCm: long, heightCm: short } : { widthCm: short, heightCm: long };
}

export function orientationOf(width: number | null | undefined, height: number | null | undefined): Orientation | null {
  if (!width || !height) return null;
  return width === height ? "square" : width > height ? "landscape" : "portrait";
}
