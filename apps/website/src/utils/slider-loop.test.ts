import { describe, expect, it } from 'vitest';
import { centerScroll, landingImageSizes, planMove, shouldLoop } from './slider-loop';

// Three identical copies, each `loop` px apart; the viewport can sit anywhere in [0, max].
const loop = 1000;
const max = 2400; // 3 × 1000 minus a 600px viewport

describe('planMove', () => {
    it('moves in place when the whole move fits', () => {
        expect(planMove(1200, 300, loop, max)).toEqual({ start: 1200, target: 1500 });
    });

    it('jumps back one copy before a forward move that would run off the end', () => {
        expect(planMove(2300, 360, loop, max)).toEqual({ start: 1300, target: 1660 });
    });

    it('jumps forward one copy before a backward move that would run off the start', () => {
        expect(planMove(100, -360, loop, max)).toEqual({ start: 1100, target: 740 });
    });

    it('never starts below zero or targets past the end', () => {
        for (let current = 0; current <= max; current += 37) {
            for (const delta of [-600, -120, 120, 600]) {
                const { start, target } = planMove(current, delta, loop, max);
                expect(Math.abs(start - current) % loop).toBe(0);
                expect(Math.min(start, target)).toBeGreaterThanOrEqual(0);
                expect(Math.max(start, target)).toBeLessThanOrEqual(max);
            }
        }
    });
});

describe('centerScroll', () => {
    it('brings an edge position to the equivalent spot nearest the middle', () => {
        expect(centerScroll(0, loop, max)).toBe(1000);
        expect(centerScroll(2350, loop, max)).toBe(1350);
    });

    it('leaves a middle position alone', () => {
        expect(centerScroll(1200, loop, max)).toBe(1200);
    });
});

describe('shouldLoop', () => {
    it('does not loop when the track fits the viewport', () => {
        expect(shouldLoop(900, 1000)).toBe(false);
    });

    it('loops when the track overflows the viewport', () => {
        expect(shouldLoop(3000, 1000)).toBe(true);
    });
});

describe('landingImageSizes', () => {
    it('scales the screen-filling image height by the aspect at every width', () => {
        expect(landingImageSizes(0.8)).toBe('(max-width: 639px) calc((100vh - 136px) * 0.8), calc((100vh - 144px) * 0.8)');
    });

    it('rounds the aspect to three decimals', () => {
        expect(landingImageSizes(4 / 3)).toContain('* 1.333)');
    });
});
