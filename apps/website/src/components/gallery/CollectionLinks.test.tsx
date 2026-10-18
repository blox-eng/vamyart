import { describe, expect, it } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { CollectionLinks } from './CollectionLinks';

describe('CollectionLinks', () => {
    it("links each of the piece's collections", () => {
        const html = renderToString(
            <dl>
                <CollectionLinks
                    collections={[
                        { slug: 'photography', title: 'Photography' },
                        { slug: 'oil-on-canvas', title: 'Oil on canvas' },
                    ]}
                />
            </dl>
        );
        expect(html).toContain('Part of');
        expect(html).toContain('href="/gallery/collections/photography"');
        expect(html).toContain('>Photography</a>');
        expect(html).toContain('href="/gallery/collections/oil-on-canvas"');
    });

    it('renders nothing for a piece in no public collection', () => {
        expect(renderToString(<CollectionLinks collections={[]} />)).toBe('');
    });
});
