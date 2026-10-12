import { describe, expect, it } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import type { GalleryPiece } from '@vamy/db';
import LandingSlider from './LandingSlider';

const pieces: GalleryPiece[] = [
    { slug: 'silence', title: 'Silence', excerpt: 'A bone sky over aubergine land', medium: 'Oil', image: { url: 'https://cdn.test/a.jpg', width: 1600, height: 2000, alt: 'Silence, Oil, by Maeve Vamy' } },
    { slug: 'tide', title: 'Tide', excerpt: '  ', medium: null, image: { url: 'https://cdn.test/b.jpg', width: null, height: null, alt: 'Tide, by Maeve Vamy' } },
    { slug: 'unseen', title: 'Unseen', excerpt: null, medium: null, image: null },
];

const render = (p: GalleryPiece[]) => renderToString(<LandingSlider pieces={p} contactEmail="maeve@vamy.art" />);

describe('LandingSlider server render', () => {
    const html = render(pieces);

    it('renders one copy of each piece with an image, skipping image-less pieces', () => {
        expect(html.match(/href="\/gallery\//g)).toHaveLength(2);
        expect(html).not.toContain('/gallery/unseen/');
        expect(html).not.toContain('aria-hidden');
    });

    it('loads the first image eagerly at high priority and the rest lazily', () => {
        const imgs = html.match(/<img [^>]*>/g) ?? [];
        expect(imgs[0]).toContain('loading="eager"');
        expect(imgs[0]).toMatch(/fetchPriority="high"/i);
        expect(imgs[1]).toContain('loading="lazy"');
        expect(imgs[1]).toContain('object-fit:contain');
    });

    it('omits a blank excerpt and ends in the last frame', () => {
        expect(html.match(/landing-excerpt/g)).toHaveLength(1);
        expect(html).toContain('<p>Write to me.</p>');
        expect(html).toContain('href="mailto:maeve@vamy.art"');
        expect(html.match(/<h1/g)).toHaveLength(1);
    });

    it('has no arrow buttons: wheel, swipe and arrow keys move the strip', () => {
        expect(html).not.toContain('<button');
        expect(html).not.toContain('landing-arrows');
    });

    it('renders only the last frame when there are no pieces', () => {
        const empty = render([]);
        expect(empty).toContain('landing--empty');
        expect(empty).not.toContain('<img');
        expect(empty).toContain('Write to me.');
    });
});
