import { describe, expect, it } from 'vitest';
import { distributeColumns } from './masonry';

describe('distributeColumns', () => {
    it('alternates equal pieces across columns', () => {
        expect(distributeColumns([1, 1, 1, 1], 2)).toEqual([
            [0, 2],
            [1, 3],
        ]);
    });

    it('lets a tall piece hold its column while wide ones stack beside it', () => {
        expect(distributeColumns([0.5, 2, 2, 2], 2)).toEqual([[0], [1, 2, 3]]);
    });

    it('returns empty columns for no pieces', () => {
        expect(distributeColumns([], 4)).toEqual([[], [], [], []]);
    });

    it('places every index exactly once', () => {
        const aspects = Array.from({ length: 25 }, () => 0.4 + Math.random() * 2);
        const columns = distributeColumns(aspects, 3);
        expect(columns).toHaveLength(3);
        expect(columns.flat().sort((a, b) => a - b)).toEqual(aspects.map((_, i) => i));
    });
});
