import { parseDimensionsCm } from "@vamy/db/dimensions";

type HintInput = {
  // undefined: the piece has no photo yet, so there is nothing to describe.
  altText: string | null | undefined;
  seoDescription: string | null;
  excerpt: string | null;
  dimensions: string | null;
};

const blank = (s: string | null | undefined) => !s?.trim();

// Gentle nudges for what search engines can't read yet. Never blocking.
export function seoHints({ altText, seoDescription, excerpt, dimensions }: HintInput): string[] {
  const hints: string[] = [];
  if (altText !== undefined && blank(altText)) hints.push("Add alt text so search engines and screen readers know what the painting shows.");
  if (blank(seoDescription) && blank(excerpt)) hints.push("Add a short description for search results.");
  // Only the format is checked here; the photo decides which side is the width.
  if (!blank(dimensions) && !parseDimensionsCm(dimensions, "landscape")) {
    hints.push("Write dimensions as width × height cm (e.g. 60 × 40 cm) so they show up in search.");
  }
  return hints;
}
