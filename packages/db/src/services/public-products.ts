// What a buyer may see of a piece's products: active ones, their available variants.
export function publicProducts<V extends { available: boolean }, P extends { active: boolean; variants: V[] }>(
  products: P[],
): P[] {
  return products
    .filter((p) => p.active)
    .map((p) => ({ ...p, variants: p.variants.filter((v) => v.available) }))
    .filter((p) => p.variants.length > 0);
}
