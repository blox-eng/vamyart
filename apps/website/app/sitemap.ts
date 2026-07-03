import type { MetadataRoute } from 'next';
import { appRouter } from '@vamy/db/trpc';

// Same precedence as the canonical/og:url builder (seo-utils resolveSiteUrl,
// where site.env.URL is process.env.URL): Netlify deploy URL first, then the
// explicit fallback. Keeps every sitemap URL host-identical to the page canonical.
const SITE_URL = (process.env.URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://vamy.art').replace(/\/+$/, '');
const serverTrpc = appRouter.createCaller({ userId: null });

export const revalidate = 3600;

const STATIC_ROUTES = ['/', '/about/', '/gallery/', '/get-a-piece/', '/terms/', '/privacy/'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const staticEntries = STATIC_ROUTES.map((path) => ({
        url: `${SITE_URL}${path}`,
        changeFrequency: 'weekly' as const,
        priority: path === '/' ? 1 : 0.7,
    }));

    let galleryEntries: MetadataRoute.Sitemap = [];
    try {
        const pieces = await serverTrpc.artworks.listPublic();
        galleryEntries = pieces.map((a: { slug: string; updatedAt?: string | Date }) => ({
            url: `${SITE_URL}/gallery/${a.slug}/`,
            lastModified: a.updatedAt ? new Date(a.updatedAt) : undefined,
            changeFrequency: 'monthly' as const,
            priority: 0.8,
        }));
    } catch {
        // DB unavailable — return static routes only rather than 500 the sitemap.
    }

    return [...staticEntries, ...galleryEntries];
}
