import type { MetadataRoute } from 'next';

// Same precedence as the canonical/og:url builder (seo-utils resolveSiteUrl,
// where site.env.URL is process.env.URL): Netlify deploy URL first, then the
// explicit fallback. Keeps robots/sitemap host identical to the canonical host.
const SITE_URL = (process.env.URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://vamy.art').replace(/\/+$/, '');

export default function robots(): MetadataRoute.Robots {
    return {
        rules: { userAgent: '*', allow: '/' },
        sitemap: `${SITE_URL}/sitemap.xml`,
        host: SITE_URL,
    };
}
