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
    // No lastModified for static pages: Google trusts lastmod only when it is accurate.
    const staticEntries = STATIC_ROUTES.map((path) => ({ url: `${SITE_URL}${path}` }));

    let galleryEntries: MetadataRoute.Sitemap = [];
    try {
        const pieces = await serverTrpc.artworks.listPublic();
        galleryEntries = pieces.map((a: { slug: string; updatedAt?: string | Date; images: string[] }) => ({
            url: `${SITE_URL}/gallery/${a.slug}/`,
            lastModified: a.updatedAt ? new Date(a.updatedAt) : undefined,
            images: a.images,
        }));
    } catch {
        // DB unavailable — return static routes only rather than 500 the sitemap.
    }

    let collectionEntries: MetadataRoute.Sitemap = [];
    try {
        // The wall's filters are exactly the collection pages that render (not 404).
        const { filters } = await serverTrpc.gallery.wall({});
        collectionEntries = filters.map((c) => ({
            url: `${SITE_URL}/gallery/collections/${c.slug}/`,
            lastModified: new Date(c.updatedAt),
        }));
    } catch {
        // DB unavailable — return static routes only rather than 500 the sitemap.
    }

    return [...staticEntries, ...galleryEntries, ...collectionEntries];
}
