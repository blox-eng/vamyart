import React from 'react';
import { allContent } from '../../utils/local-content';
import DefaultBaseLayout from '../../components/layouts/DefaultBaseLayout';
import PageHead from '../../components/atoms/PageHead';
import GalleryWall from '../../components/gallery/GalleryWall';
import { ogImageUrl, resolveSiteUrl } from '../../utils/seo-utils';
import { buildBreadcrumbJsonLd, buildCollectionJsonLd, wallItemListPieces } from '../../utils/structured-data';
import { appRouter } from '@vamy/db/trpc';

const serverTrpc = appRouter.createCaller({ userId: null });

const TITLE = 'on the wall';
const DESCRIPTION =
    'Original fine art by Maeve Vamy — muted seascapes, abstract figurations, and surreal studies in warm, earthy tones.';

function Page({ site, pieces, filters }) {
    const base = resolveSiteUrl(site);
    const url = `${base}/gallery/`;
    const firstImage = pieces.find((p) => p.image)?.image;
    const jsonLd = [
        buildCollectionJsonLd({
            base,
            name: TITLE,
            description: DESCRIPTION,
            url,
            pieces: wallItemListPieces(base, pieces),
        }),
        buildBreadcrumbJsonLd(base, [{ name: TITLE, path: '/gallery/' }]),
    ];
    return (
        <DefaultBaseLayout page={{ __metadata: { id: 'gallery' } }} site={site}>
            <PageHead
                title={TITLE}
                description={DESCRIPTION}
                canonicalPath="/gallery/"
                ogImage={firstImage ? ogImageUrl(firstImage.url, base) : null}
                jsonLd={jsonLd}
                site={site}
            />
            <GalleryWall pieces={pieces} filters={filters} activeSlug={null} />
        </DefaultBaseLayout>
    );
}

export async function getStaticProps() {
    const { props: { site } } = allContent();
    // No try: if the DB is down, ISR keeps serving the last good page (a build fails loudly).
    const { pieces, filters } = await serverTrpc.gallery.wall({});
    return { props: { site: JSON.parse(JSON.stringify(site)), pieces, filters }, revalidate: 3600 };
}

export default Page;
