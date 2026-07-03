import React from 'react';
import Head from 'next/head';
import { allContent } from '../utils/local-content';
import { getComponent } from '../components/components-registry';
import { resolveStaticProps } from '../utils/static-props-resolvers';
import { resolveStaticPaths } from '../utils/static-paths-resolvers';
import { seoGenerateTitle, seoGenerateMetaTags, seoGenerateMetaDescription, seoGenerateCanonicalUrl, resolveSiteUrl } from '../utils/seo-utils';
import { buildHeroPreload } from '../utils/netlify-image';
import { buildWebsiteJsonLd, buildPersonJsonLd } from '../utils/structured-data';
import JsonLd from '../components/atoms/JsonLd';
import { appRouter } from '@vamy/db/trpc';

// Server-side tRPC caller for homepage DB injection (featured image + active banner).
const serverTrpc = appRouter.createCaller({ userId: null });


function Page(props) {
    const { page, site } = props;
    const { modelName } = page.__metadata;
    if (!modelName) {
        throw new Error(`page has no type, page '${props.path}'`);
    }
    const PageLayout = getComponent(modelName);
    if (!PageLayout) {
        throw new Error(`no page layout matching the page model: ${modelName}`);
    }
    const title = seoGenerateTitle(page, site);
    const metaTags = seoGenerateMetaTags(page, site);
    const metaDescription = seoGenerateMetaDescription(page, site);
    const canonicalUrl = seoGenerateCanonicalUrl(page, site);
    const heroPreload = page.heroPreload ? buildHeroPreload(page.heroPreload.url, { sizes: page.heroPreload.sizes }) : null;
    const isHome = page.__metadata?.urlPath === '/';
    const base = resolveSiteUrl(site);
    const socialLinks = Array.isArray(site.footer?.socialLinks)
        ? site.footer.socialLinks.map((l) => l.url).filter(Boolean)
        : [];
    return (
        <>
            <Head>
                <title>{title}</title>
                {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
                {metaDescription && <meta name="description" content={metaDescription} />}
                {metaTags.map((metaTag) => {
                    if (metaTag.format === 'property') {
                        // OpenGraph meta tags (og:*) should be have the format <meta property="og:…" content="…">
                        return <meta key={metaTag.property} property={metaTag.property} content={metaTag.content} />;
                    }
                    return <meta key={metaTag.property} name={metaTag.property} content={metaTag.content} />;
                })}
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                {heroPreload && (
                    <link
                        rel="preload"
                        as="image"
                        href={heroPreload.href}
                        imageSrcSet={heroPreload.imageSrcSet}
                        imageSizes={heroPreload.imageSizes}
                        fetchPriority="high"
                    />
                )}
                {site.favicon && <link rel="icon" href={site.favicon} />}
                {isHome && base && (
                    <>
                        <JsonLd data={buildWebsiteJsonLd(base)} />
                        <JsonLd data={buildPersonJsonLd(base, socialLinks)} />
                    </>
                )}
            </Head>
            <PageLayout page={page} site={site} />
        </>
    );
}

export function getStaticPaths() {
    const data = allContent();
    const paths = resolveStaticPaths(data);
    // Exclude paths handled by dedicated page files
    const filtered = paths.filter(
        (p) => p !== "/get-a-piece" && p !== "/gallery" && !p.startsWith("/gallery/")
    );
    return { paths: filtered, fallback: 'blocking' };
}

export async function getStaticProps({ params }) {
    const data = allContent();
    const urlPath = '/' + (params.slug || []).join('/');
    const props = await resolveStaticProps(urlPath, data);

    // Homepage: inject featured artwork image + active banner server-side.
    // The hero features the artwork flagged `featured` in the admin (artworks.getFeatured),
    // not a print product. When nothing is featured, the markdown default image stands.
    if (urlPath === '/') {
        try {
            const featured = await serverTrpc.artworks.getFeatured();
            if (featured?.primaryImage) {
                const heroSection = props.page?.sections?.[0];
                if (heroSection?.media) {
                    heroSection.media.url = featured.primaryImage.url;
                    heroSection.media.altText = featured.primaryImage.altText || `${featured.title} by Maeve Vamy`;
                    heroSection.media.priority = true;
                    props.page.heroPreload = { url: featured.primaryImage.url, sizes: heroSection.media.sizes ?? '100vw' };
                }
            }
        } catch {
            // Fallback to the markdown default if the DB is unavailable at build time.
        }

        try {
            const banner = await serverTrpc.banners.getActive({ slug: '' });
            if (banner) {
                props.site.activeBanner = banner;
            }
        } catch {
            // No banner — component handles null gracefully
        }
    }

    return { props, revalidate: 3600 };
}

export default Page;
