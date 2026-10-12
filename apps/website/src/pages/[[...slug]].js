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

// Server-side tRPC caller for homepage DB injection (active banner + collections).
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
        ? site.footer.socialLinks.map((l) => l.url).filter((u) => /^https?:\/\//.test(u))
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

    // Homepage: inject the active banner and published collections server-side.
    if (urlPath === '/') {
        try {
            const banner = await serverTrpc.banners.getActive({ slug: '' });
            if (banner) {
                props.site.activeBanner = banner;
            }
        } catch {
            // No banner — component handles null gracefully
        }

        try {
            const publishedCollections = await serverTrpc.collections.listPublic();
            const sections = props.page?.sections ?? [];
            const carouselIdx = sections.findIndex((s) => s?.elementId === 'collections-carousel');
            if (carouselIdx !== -1) {
                if (publishedCollections.length) {
                    sections[carouselIdx].collections = publishedCollections;
                } else {
                    // No published collections — drop the placeholder rather than render empty.
                    sections.splice(carouselIdx, 1);
                }
            }
        } catch {
            // DB unavailable at build — remove the carousel section so nothing empty renders.
            const sections = props.page?.sections ?? [];
            const carouselIdx = sections.findIndex((s) => s?.elementId === 'collections-carousel');
            if (carouselIdx !== -1) sections.splice(carouselIdx, 1);
        }
    }

    return { props, revalidate: 3600 };
}

export default Page;
