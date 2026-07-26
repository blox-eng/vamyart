// Website-local copy of the sold predicate. Deliberately NOT imported from @vamy/db —
// that package re-exports the Postgres client, which would pull it into the browser
// bundle. Keep this behaviorally identical to `isVariantSold` in
// packages/db/src/services/variant-sold.ts; both are pinned by matching truth-table
// tests (variant-sold.test.ts in each package) so the copies can't silently drift.
export type VariantSoldFields = {
    isOriginal: boolean;
    soldAt: string | Date | null;
    stockQuantity: number;
};

export function isVariantSold(v: VariantSoldFields): boolean {
    return v.soldAt != null || (v.isOriginal && v.stockQuantity <= 0);
}
