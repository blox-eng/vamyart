import { describe, expect, it } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { PaintSplashes, splashLabel } from './PaintSplashes';

const palette = {
    swatches: [
        {
            hex: '#1f2b7a',
            name: 'deep night blue',
            area: 0.6,
            recipe: {
                hex: '#1f2b7a',
                deltaE: 0.4,
                parts: [
                    { paintId: 'u', name: 'Ultramarine Blue', pigments: ['PB29'], parts: 3 },
                    { paintId: 's', name: 'Burnt Sienna', pigments: ['PR101'], parts: 1 },
                ],
            },
        },
        { hex: '#c4963d', name: '', area: 0.4, recipe: null },
    ],
};

describe('splashLabel', () => {
    it('names the colour and how to mix it', () => {
        expect(splashLabel(palette.swatches[0])).toBe('deep night blue — Ultramarine Blue 3 : Burnt Sienna 1');
    });
    it('falls back to the colour code when nothing else is known', () => {
        expect(splashLabel(palette.swatches[1])).toBe('#c4963d');
    });
});

describe('PaintSplashes', () => {
    it('renders one labelled splash per colour, filled with the exact colour', () => {
        const html = renderToString(<PaintSplashes palette={palette} />);
        expect(html).toContain('aria-label="Palette"');
        expect(html).toContain('aria-label="deep night blue — Ultramarine Blue 3 : Burnt Sienna 1"');
        expect(html).toContain('fill="#1f2b7a"');
        expect(html).toContain('fill="#c4963d"');
        expect(html).not.toMatch(/opacity|filter|shadow/);
    });
});
