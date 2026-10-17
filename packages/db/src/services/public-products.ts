import { isVariantSold, type VariantSoldState } from "./variant-sold";

type PublicVariant = VariantSoldState & { available: boolean; price: string | null };

// What a buyer may see of a piece's products: active ones, their available variants,
// and no price on anything already sold (it would sit in the page's HTML otherwise).
export function publicProducts<V extends PublicVariant, P extends { active: boolean; variants: V[] }>(
  products: P[],
): P[] {
  return products
    .filter((p) => p.active)
    .map((p) => ({
      ...p,
      variants: p.variants
        .filter((v) => v.available)
        .map((v) => (isVariantSold(v) ? { ...v, price: null } : v)),
    }))
    .filter((p) => p.variants.length > 0);
}
