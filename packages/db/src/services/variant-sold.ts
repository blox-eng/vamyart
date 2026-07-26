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
