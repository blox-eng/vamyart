import React from 'react';
import { allContent } from '../../../utils/local-content';
import DefaultBaseLayout from '../../../components/layouts/DefaultBaseLayout';
import PageHead from '../../../components/atoms/PageHead';
import GalleryWall from '../../../components/gallery/GalleryWall';
import { ogImageUrl, resolveSiteUrl } from '../../../utils/seo-utils';
import { buildBreadcrumbJsonLd, buildCollectionJsonLd } from '../../../utils/structured-data';
import { appRouter } from '@vamy/db/trpc';

const serverTrpc = appRouter.createCaller({ userId: null });

const REVALIDATE = 3600;

function Page({ site, pieces, filters, collection }) {
    const base = resolveSiteUrl(site);
    const path = `/gallery/collections/${collection.slug}/`;
    const description =
        collection.seoDescription || collection.description || `${collection.title} by Maeve Vamy: ${pieces.length} piece${pieces.length === 1 ? '' : 's'}`;
    const ogSource = collection.coverUrl ?? pieces.find((p) => p.image)?.image.url ?? null;
    const jsonLd = [
        buildCollectionJsonLd({
            name: collection.title,
            description,
            url: `${base}${path}`,
            pieces: pieces.map((p) => ({ name: p.title, url: `${base}/gallery/${p.slug}/` })),
        }),
        buildBreadcrumbJsonLd(base, [
            { name: 'on the wall', path: '/gallery/' },
            { name: collection.title, path },
        ]),
    ];
    return (
        <DefaultBaseLayout page={{ __metadata: { id: `collection-${collection.slug}` } }} site={site}>
            <PageHead
                title={collection.seoTitle ?? collection.title}
                description={description}
                canonicalPath={path}
                ogImage={ogSource ? ogImageUrl(ogSource, base) : null}
                jsonLd={jsonLd}
                site={site}
            />
            <GalleryWall pieces={pieces} filters={filters} activeSlug={collection.slug} />
        </DefaultBaseLayout>
    );
}

export async function getStaticPaths() {
    const { filters } = await serverTrpc.gallery.wall({});
    return { paths: filters.map((f) => ({ params: { slug: f.slug } })), fallback: 'blocking' };
}

export async function getStaticProps({ params }) {
    const { props: { site } } = allContent();
    try {
        const { pieces, filters, collection } = await serverTrpc.gallery.wall({ collectionSlug: params.slug });
        return { props: { site: JSON.parse(JSON.stringify(site)), pieces, filters, collection }, revalidate: REVALIDATE };
    } catch (err) {
        // Unknown or hidden collection: 404 now, but it may be published later.
        if (err?.code === 'NOT_FOUND') return { notFound: true, revalidate: REVALIDATE };
        // Anything else: ISR keeps serving the last good page.
        throw err;
    }
}

export default Page;
