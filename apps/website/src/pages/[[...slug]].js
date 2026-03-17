import React from 'react';
import Head from 'next/head';
import { allContent } from '../utils/local-content';
import { getComponent } from '../components/components-registry';
import { resolveStaticProps } from '../utils/static-props-resolvers';
import { resolveStaticPaths } from '../utils/static-paths-resolvers';
import { seoGenerateTitle, seoGenerateMetaTags, seoGenerateMetaDescription } from '../utils/seo-utils';
import { appRouter } from '@vamy/db/trpc';

// Scaffolding for Tasks 5-7: server-side DB injection into getStaticProps
// Used in the homepage, gallery, and artwork detail blocks below
const serverTrpc = appRouter.createCaller({ userId: null });

// Strip non-serializable values (Date objects from Drizzle) before returning via getStaticProps
function toJson(value) {
    return JSON.parse(JSON.stringify(value));
}

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
    return (
        <>
            <Head>
                <title>{title}</title>
                {metaDescription && <meta name="description" content={metaDescription} />}
                {metaTags.map((metaTag) => {
                    if (metaTag.format === 'property') {
                        // OpenGraph meta tags (og:*) should be have the format <meta property="og:…" content="…">
                        return <meta key={metaTag.property} property={metaTag.property} content={metaTag.content} />;
                    }
                    return <meta key={metaTag.property} name={metaTag.property} content={metaTag.content} />;
                })}
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                {site.favicon && <link rel="icon" href={site.favicon} />}
            </Head>
            <PageLayout page={page} site={site} />
        </>
    );
}

export function getStaticPaths() {
    const data = allContent();
    const paths = resolveStaticPaths(data);
    // Exclude paths handled by dedicated page files
    const filtered = paths.filter(p => p !== "/get-a-piece");
    return { paths: filtered, fallback: 'blocking' };
}

export async function getStaticProps({ params }) {
    const data = allContent();
    const urlPath = '/' + (params.slug || []).join('/');
    const props = await resolveStaticProps(urlPath, data);

    // Homepage: inject featured artwork image + active banner server-side
    if (urlPath === '/') {
        try {
            const featured = await serverTrpc.products.getFeatured();
            if (featured?.artwork) {
                const heroSection = props.page?.sections?.[0];
                if (heroSection?.media) {
                    if (featured.artworkId) {
                        const images = await serverTrpc.artworkImages.list({ artworkId: featured.artworkId });
                        const primary = images.find(img => img.isPrimary);
                        if (primary) {
                            heroSection.media.url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/artwork-images/${primary.storagePath}`;
                            heroSection.media.altText = primary.altText || `${featured.artwork.title} by Maeve Vamy`;
                        } else if (heroSection.media.url?.includes('placeholder')) {
                            heroSection.media.url = `/images/${featured.artwork.slug}.jpg`;
                            heroSection.media.altText = `${featured.artwork.title} by Maeve Vamy`;
                        }
                    }
                }
            }
        } catch {
            // Fallback to placeholder if DB unavailable at build time
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

    // Gallery index: attach product data to posts for server-side rendering
    if (urlPath === '/gallery' && props.page?.items) {
        try {
            props.page.items = await Promise.all(
                props.page.items.map(async (post) => {
                    const postSlug = post.__metadata?.urlPath?.split('/').filter(Boolean).pop();
                    if (!postSlug) return post;
                    try {
                        const products = await serverTrpc.products.listByArtworkSlug({ slug: postSlug });
                        let updatedPost = { ...post };
                        if (products.length > 0) {
                            updatedPost.artworkProducts = toJson(products);
                            const artworkId = products[0].artworkId;
                            if (artworkId) {
                                const images = await serverTrpc.artworkImages.list({ artworkId });
                                const primary = images.find(img => img.isPrimary);
                                if (primary) {
                                    updatedPost.featuredImage = {
                                        ...(post.featuredImage || {}),
                                        url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/artwork-images/${primary.storagePath}`,
                                        altText: primary.altText || post.featuredImage?.altText || post.title,
                                    };
                                }
                            }
                        }
                        return updatedPost;
                    } catch {
                        // Product unavailable for this slug
                    }
                    return post;
                })
            );
        } catch {
            // Products unavailable at build time — cards render without pricing
        }
    }

    // Gallery detail: /gallery/{slug} — exactly 2 path segments
    if (urlPath.startsWith('/gallery/') && urlPath.split('/').filter(Boolean).length === 2) {
        const artworkSlug = urlPath.split('/').filter(Boolean).pop();
        try {
            const products = await serverTrpc.products.listByArtworkSlug({ slug: artworkSlug });
            if (products.length > 0) {
                props.page.artworkProducts = toJson(products);
                const artworkId = products[0].artworkId;
                if (artworkId) {
                    const images = await serverTrpc.artworkImages.list({ artworkId });
                    const primary = images.find(img => img.isPrimary);
                    if (primary) {
                        props.page.featuredImage = {
                            ...(props.page.featuredImage || {}),
                            url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/artwork-images/${primary.storagePath}`,
                            altText: primary.altText || props.page.featuredImage?.altText || props.page.title,
                        };
                    }
                }
            }
        } catch {
            // Product unavailable at build time — detail renders without pricing
        }
    }

    return { props, revalidate: 3600 };
}

export default Page;
