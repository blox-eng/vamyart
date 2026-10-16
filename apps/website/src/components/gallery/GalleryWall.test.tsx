import { describe, expect, it } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import type { GalleryPiece } from '@vamy/db';
import GalleryWall from './GalleryWall';

const pieces: GalleryPiece[] = [
    { slug: 'silence', title: 'Silence', sold: false, soldAt: null, excerpt: null, medium: 'Oil', image: { url: 'https://cdn.test/a.jpg', width: 1600, height: 2000, alt: 'Silence, Oil, by Maeve Vamy' } },
    { slug: 'tide', title: 'Tide', sold: true, soldAt: '2026-03-14T10:00:00.000Z', excerpt: null, medium: null, image: { url: 'https://cdn.test/b.jpg', width: null, height: null, alt: 'Tide, by Maeve Vamy' } },
    { slug: 'unseen', title: 'Unseen', sold: false, soldAt: null, excerpt: null, medium: null, image: null },
];
const filters = [
    { slug: 'seascapes', title: 'Seascapes' },
    { slug: 'studies', title: 'Studies' },
];

// next/link applies trailingSlash only inside a Next build, so filter hrefs are matched without it here.
const currentHref = (html: string) => html.match(/<a aria-current="page" href="([^"]*)"/)?.[1]?.replace(/\/?$/, '/');

const render = (props: Partial<React.ComponentProps<typeof GalleryWall>> = {}) =>
    renderToString(<GalleryWall pieces={pieces} filters={filters} activeSlug={null} {...props} />);

describe('GalleryWall server render', () => {
    it('renders one h1 and three column variants', () => {
        const html = render();
        expect(html.match(/<h1/g)).toHaveLength(1);
        expect(html).toContain('>on the wall</h1>');
        for (const v of ['wall--c2', 'wall--c3', 'wall--c4']) expect(html).toContain(v);
    });

    it('renders each piece with an image once per variant as a labelled lazy tile, skipping image-less pieces', () => {
        const html = render();
        expect(html.match(/<a href="\/gallery\/silence\/" aria-label="Silence"/g)).toHaveLength(3);
        expect(html.match(/<a href="\/gallery\/tide\/" aria-label="Tide"/g)).toHaveLength(3);
        expect(html).not.toContain('/gallery/unseen/');
        const imgs = html.match(/<img [^>]*>/g) ?? [];
        expect(imgs).toHaveLength(6);
        for (const img of imgs) expect(img).toContain('loading="lazy"');
        expect(imgs[0]).toContain('width="1600"');
        expect(imgs[0]).toContain('aspect-ratio:0.8');
    });

    it('marks "all" as the current filter on the full wall', () => {
        const nav = render().match(/<nav aria-label="Collections"[^]*?<\/nav>/)?.[0] ?? '';
        expect(currentHref(nav)).toBe('/gallery/');
        expect(nav).toMatch(/href="\/gallery\/collections\/seascapes\/?"/);
        expect(nav.match(/aria-current/g)).toHaveLength(1);
    });

    it('titles a collection page with its name and marks its filter current', () => {
        const html = render({ activeSlug: 'studies' });
        expect(html).toContain('>Studies</h1>');
        expect(currentHref(html)).toBe('/gallery/collections/studies/');
        expect(html.match(/aria-current/g)).toHaveLength(1);
    });

    it('drops the filter row when there are no collections', () => {
        expect(render({ filters: [] })).not.toContain('<nav');
    });

    it('marks only sold pieces with a labelled red dot', () => {
        const html = render();
        const dots = html.match(/<span class="sold-dot sold-dot--wall"[^>]*>/g) ?? [];
        expect(dots).toHaveLength(3);
        expect(dots[0]).toContain('aria-label="Sold in March 2026"');
        expect(html.match(/<span class="wall-sold">Sold in March 2026<\/span>/g)).toHaveLength(3);
    });
});
