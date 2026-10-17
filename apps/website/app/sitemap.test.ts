import { describe, expect, it, vi } from 'vitest';

vi.mock('@vamy/db/trpc', () => ({
    appRouter: {
        createCaller: () => ({
            artworks: {
                listPublic: async () => [
                    { slug: 'never', updatedAt: '2026-10-15T00:00:00Z', images: ['https://cdn/never.jpg', 'https://cdn/never-2.jpg'] },
                ],
            },
            gallery: {
                wall: async () => ({ filters: [{ slug: 'studies', updatedAt: '2026-10-01T00:00:00Z' }] }),
            },
        }),
    },
}));

const { default: sitemap } = await import('./sitemap');
const { default: robots } = await import('./robots');

describe('sitemap', () => {
    it('lists every image of a piece', async () => {
        const piece = (await sitemap()).find((e) => e.url.endsWith('/gallery/never/'));
        expect(piece?.images).toEqual(['https://cdn/never.jpg', 'https://cdn/never-2.jpg']);
        expect(piece?.lastModified).toEqual(new Date('2026-10-15T00:00:00Z'));
    });
    it('drops the fields Google ignores and invented dates', async () => {
        for (const e of await sitemap()) {
            expect(e).not.toHaveProperty('priority');
            expect(e).not.toHaveProperty('changeFrequency');
        }
        expect((await sitemap()).find((e) => e.url.endsWith('/about/'))).not.toHaveProperty('lastModified');
    });
});

describe('robots', () => {
    it('keeps crawlers out of the api, letters and order pages', () => {
        expect(robots().rules).toMatchObject({ userAgent: '*', allow: '/', disallow: ['/api/', '/letters/', '/order/'] });
    });
});
