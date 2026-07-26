import { describe, expect, it } from 'vitest';
import { isVariantSold } from './variant-sold';

// This truth table is intentionally identical to the one in
// packages/db/src/services/variant-sold.test.ts. If the two predicates ever drift,
// one of these suites breaks. Keep them in lockstep.
describe('isVariantSold (website copy — must match @vamy/db canonical)', () => {
    it('is sold when soldAt is set, regardless of stock', () => {
        expect(isVariantSold({ isOriginal: false, soldAt: new Date(), stockQuantity: 5 })).toBe(true);
    });
    it('is sold when an original is out of stock', () => {
        expect(isVariantSold({ isOriginal: true, soldAt: null, stockQuantity: 0 })).toBe(true);
    });
    it('is NOT sold for a non-original edition that is out of stock', () => {
        expect(isVariantSold({ isOriginal: false, soldAt: null, stockQuantity: 0 })).toBe(false);
    });
    it('is NOT sold for an in-stock original', () => {
        expect(isVariantSold({ isOriginal: true, soldAt: null, stockQuantity: 1 })).toBe(false);
    });
    it('is NOT sold for a normal for-sale variant', () => {
        expect(isVariantSold({ isOriginal: false, soldAt: null, stockQuantity: 3 })).toBe(false);
    });
    it('treats a string soldAt (as it arrives over the wire) as sold', () => {
        expect(isVariantSold({ isOriginal: false, soldAt: '2026-07-26T00:00:00Z', stockQuantity: 2 })).toBe(true);
    });
});
