import { describe, expect, it } from 'vitest';
import { landingImageSizes, shouldLoop, wrapScroll } from './slider-loop';

describe('wrapScroll', () => {
    it('jumps back one loop once the first copy has scrolled past', () => {
        expect(wrapScroll(1200, 1000)).toBe(200);
    });

    it('leaves the position alone inside the first copy', () => {
        expect(wrapScroll(999, 1000)).toBe(999);
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
    it('scales the fixed strip height by the aspect, full width on phones', () => {
        expect(landingImageSizes(0.8)).toBe('(max-width: 639px) calc(100vw - 32px), calc((78vh - 72px) * 0.8)');
    });
});
