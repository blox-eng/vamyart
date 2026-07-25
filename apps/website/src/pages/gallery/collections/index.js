import React from 'react';
import Head from 'next/head';
import { allContent } from '../../../utils/local-content';
import { getComponent } from '../../../components/components-registry';
import { seoGenerateTitle, seoGenerateMetaTags, seoGenerateMetaDescription } from '../../../utils/seo-utils';
import { appRouter } from '@vamy/db/trpc';

const serverTrpc = appRouter.createCaller({ userId: null });

function toJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function Page({ page, site }) {
  const PageLayout = getComponent('PostFeedLayout');
  const title = seoGenerateTitle(page, site);
  const metaTags = seoGenerateMetaTags(page, site);
  const metaDescription = seoGenerateMetaDescription(page, site);
  return (
    <>
      <Head>
        <title>{title}</title>
        {metaDescription && <meta name="description" content={metaDescription} />}
        {metaTags.map((m) =>
          m.format === 'property' ? (
            <meta key={m.property} property={m.property} content={m.content} />
          ) : (
            <meta key={m.property} name={m.property} content={m.content} />
          )
        )}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {site.favicon && <link rel="icon" href={site.favicon} />}
      </Head>
      <PageLayout page={page} site={site} />
    </>
  );
}

export async function getStaticProps() {
  const { props: { site } } = allContent();

  let collections = [];
  try {
    collections = await serverTrpc.collections.listPublic();
  } catch {
    // DB unavailable at build — render an empty list; ISR will refill.
  }

  const items = collections.map((c) => {
    const pieceLabel = `${c.pieceCount} piece${c.pieceCount === 1 ? '' : 's'}`;
    return {
      title: c.title,
      // Bare slug: getPageUrl() (page-utils) prepends "/gallery" for PostLayout items,
      // so urlPath is set explicitly below to point at the collection detail route.
      slug: c.slug,
      excerpt: c.description ? `${pieceLabel} · ${c.description}` : pieceLabel,
      featuredImage: c.coverUrl ? { url: c.coverUrl, altText: c.title, type: 'ImageBlock' } : null,
      colors: 'bg-light-fg-dark',
      styles: { self: { flexDirection: 'row' } },
      __metadata: { modelName: 'PostLayout', urlPath: `/gallery/collections/${c.slug}`, id: c.id },
    };
  });

  const page = {
    __metadata: { modelName: 'PostFeedLayout', urlPath: '/gallery/collections', id: 'gallery-collections-index' },
    title: 'Collections',
    enableSearch: false,
    topSections: [],
    bottomSections: [],
    seo: {
      metaTitle: 'Collections - Maeve Vamy',
      metaDescription: 'Browse curated collections of original fine art by Maeve Vamy.',
      addTitleSuffix: false,
      type: 'Seo',
    },
    pageIndex: 0,
    baseUrlPath: '/gallery/collections',
    numOfPages: 1,
    items: toJson(items),
    postFeed: {
      type: 'PagedPostsSection',
      title: null,
      subtitle: null,
      showThumbnail: true,
      showExcerpt: true,
      showDate: false,
      showAuthor: false,
      actions: [],
      elementId: null,
      variant: 'big-list',
      colors: 'bg-light-fg-dark',
      hoverEffect: 'move-up',
    },
  };

  return { props: { page, site: toJson(site) }, revalidate: 3600 };
}

export default Page;
