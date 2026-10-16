import { describe, expect, it } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { SoldMark, soldLabel } from './SoldDot';

describe('soldLabel', () => {
    it('names the month the piece sold', () => {
        expect(soldLabel('2026-03-14T10:00:00.000Z')).toBe('Sold in March 2026');
    });
    it('falls back to "Sold" when the date is unknown', () => {
        expect(soldLabel(null)).toBe('Sold');
    });
});

describe('SoldMark', () => {
    it('renders a labelled dot button with a quiet commission link', () => {
        const html = renderToString(<SoldMark soldAt="2026-03-14T10:00:00.000Z" commissionHref="/get-a-piece?piece=tide" />);
        expect(html).toContain('aria-label="Sold in March 2026"');
        expect(html).toContain('aria-expanded="false"');
        expect(html).toContain('href="/get-a-piece?piece=tide"');
        expect(html).toContain('Commission a piece like this');
    });
});
