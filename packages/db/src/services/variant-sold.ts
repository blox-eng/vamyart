export type VariantSoldState = {
  isOriginal: boolean;
  soldAt: Date | string | null;
  stockQuantity: number;
};

// A variant is sold when it has been explicitly flagged (soldAt), or it is a
// one-of-a-kind original with no stock left. Non-original editions at stock 0 are
// merely out-of-stock (they can restock), so they are NOT sold.
export function isVariantSold(v: VariantSoldState): boolean {
  return v.soldAt != null || (v.isOriginal && v.stockQuantity <= 0);
}

// The webhook persists the sale timestamp when an original sells out. Only fire for an
// original that just hit zero stock and has not already been flagged.
export function shouldAutoMarkSold(v: VariantSoldState): boolean {
  return v.isOriginal && v.stockQuantity <= 0 && v.soldAt == null;
}

// A piece is sold once its original has gone, even while print editions remain. The studio's
// piece status covers sales made outside the shop, where no variant exists.
export function isPieceSold(status: string, variants: VariantSoldState[]): boolean {
  return status === "sold" || variants.some((v) => v.isOriginal && isVariantSold(v));
}

// When the original sold, for the "Sold · March 2026" note. Null when no sale date was recorded
// (an original that ran out of stock, or a piece marked sold in the studio).
export function pieceSoldAt(variants: VariantSoldState[]): Date | null {
  const times = variants.filter((v) => v.isOriginal && v.soldAt != null).map((v) => new Date(v.soldAt!).getTime());
  return times.length ? new Date(Math.max(...times)) : null;
}
