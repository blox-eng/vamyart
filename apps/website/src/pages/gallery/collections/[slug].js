import React from 'react';
import Head from 'next/head';
import { allContent } from '../../../utils/local-content';
import { getComponent } from '../../../components/components-registry';
import {
  seoGenerateTitle, seoGenerateMetaTags, seoGenerateMetaDescription, seoGenerateCanonicalUrl, resolveSiteUrl,
} from '../../../utils/seo-utils';
import { buildCollectionJsonLd, buildBreadcrumbJsonLd } from '../../../utils/structured-data';
import JsonLd from '../../../components/atoms/JsonLd';
import { appRouter } from '@vamy/db/trpc';

const serverTrpc = appRouter.createCaller({ userId: null });

function toJson(value) {
  return JSON.parse(JSON.stringify(value));
}

// Mirror the markdown content pipeline (local-content.ts): every object with a
// `type` gets `__metadata.modelName` so the section/component registry can resolve it.
function withMetadata(value) {
  if (Array.isArray(value)) return value.map(withMetadata);
  if (value && typeof value === 'object') {
    const next = {};
    for (const [k, v] of Object.entries(value)) next[k] = withMetadata(v);
    if (typeof next.type === 'string' && !next.__metadata) {
      next.__metadata = { modelName: next.type };
    }
    return next;
  }
  return value;
}

function Page({ page, site }) {
  const PageLayout = getComponent('PostFeedLayout');
  const title = seoGenerateTitle(page, site);
  const metaTags = seoGenerateMetaTags(page, site);
  const metaDescription = seoGenerateMetaDescription(page, site);
  const canonicalUrl = seoGenerateCanonicalUrl(page, site);
  const base = resolveSiteUrl(site);
  const collectionLd = buildCollectionJsonLd({
    name: page.title,
    description: metaDescription,
    url: canonicalUrl,
    pieces: page.items.map((it) => ({
      name: it.title,
      url: base ? `${base}/gallery/${it.artworkSlug}/` : `/gallery/${it.artworkSlug}`,
    })),
  });
  const breadcrumbLd = base
    ? buildBreadcrumbJsonLd(base, [
        { name: 'Gallery', path: '/gallery/' },
        { name: 'Collections', path: '/gallery/collections/' },
        { name: page.title, path: canonicalUrl?.replace(base, '') || '/' },
      ])
    : null;
  return (
    <>
      <Head>
        <title>{title}</title>
        {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
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
        {base && <JsonLd data={collectionLd} />}
        {breadcrumbLd && <JsonLd data={breadcrumbLd} />}
      </Head>
      <PageLayout page={page} site={site} />
    </>
  );
}

export async function getStaticPaths() {
  let slugs = [];
  try {
    const list = await serverTrpc.collections.listPublic();
    slugs = list.map((c) => ({ params: { slug: c.slug } }));
  } catch {
    // DB unavailable at build — rely on fallback: 'blocking'.
  }
  return { paths: slugs, fallback: 'blocking' };
}

export async function getStaticProps({ params }) {
  const { props: { site } } = allContent();

  let collection = null;
  try {
    collection = await serverTrpc.collections.getBySlug({ slug: params.slug });
  } catch {
    // fall through to notFound below
  }
  if (!collection) {
    return { notFound: true, revalidate: 3600 };
  }

  const items = collection.pieces.map((p) => ({
    title: p.title,
    slug: p.slug,
    artworkSlug: p.slug,
    excerpt: p.excerpt ?? '',
    featuredImage: p.primaryImage
      ? { url: p.primaryImage.url, altText: p.primaryImage.altText, type: 'ImageBlock' }
      : null,
    colors: 'bg-light-fg-dark',
    styles: { self: { flexDirection: 'row' } },
    __metadata: { modelName: 'PostLayout', urlPath: `/gallery/${p.slug}`, id: p.slug },
  }));

  const topSections =
    collection.title || collection.description || collection.coverUrl
      ? [
          {
            type: 'GenericSection',
            title: { type: 'TitleBlock', text: collection.title, color: 'text-dark' },
            subtitle: '',
            text: collection.description ?? '',
            actions: [],
            media: collection.coverUrl ? { type: 'ImageBlock', url: collection.coverUrl, altText: collection.title } : null,
            colors: 'bg-light-fg-dark',
            styles: { self: { flexDirection: 'row', justifyContent: 'flex-start' } },
          },
        ]
      : [];

  const page = {
    __metadata: {
      modelName: 'PostFeedLayout',
      urlPath: `/gallery/collections/${collection.slug}`,
      id: `collection-${collection.slug}`,
    },
    title: collection.title,
    enableSearch: false,
    topSections: withMetadata(topSections),
    bottomSections: [],
    seo: {
      metaTitle: collection.seoTitle ?? collection.title,
      metaDescription: collection.seoDescription ?? collection.description ?? '',
      addTitleSuffix: false,
      type: 'Seo',
    },
    pageIndex: 0,
    baseUrlPath: `/gallery/collections/${collection.slug}`,
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

  return { props: { page: toJson(page), site: toJson(site) }, revalidate: 3600 };
}

export default Page;
