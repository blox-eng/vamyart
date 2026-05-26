import React from 'react';
import Head from 'next/head';
import { allContent } from '../../utils/local-content';
import { getComponent } from '../../components/components-registry';
import { seoGenerateTitle, seoGenerateMetaTags, seoGenerateMetaDescription } from '../../utils/seo-utils';
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

// CTA block copied from the retired content/pages/gallery/index.md `bottomSections`.
const BOTTOM_SECTIONS = [
  {
    type: 'GenericSection',
    title: { type: 'TitleBlock', text: 'Commission something for your space.', color: 'text-dark' },
    subtitle: '',
    text: '',
    badge: { type: 'Badge', label: "Don't see the right piece?", color: 'text-primary' },
    actions: [
      {
        type: 'Button',
        label: 'Start a conversation',
        altText: '',
        url: '/get-a-piece/',
        showIcon: false,
        icon: 'arrowRight',
        iconPosition: 'right',
        style: 'secondary',
        elementId: '',
      },
    ],
    colors: 'bg-light-fg-dark',
    styles: {
      self: {
        flexDirection: 'col',
        justifyContent: 'center',
        textAlign: 'center',
        padding: ['pt-16', 'pl-4', 'pb-16', 'pr-4'],
        borderColor: 'border-dark',
        borderStyle: 'solid',
        borderWidth: 1,
        borderRadius: 'none',
      },
    },
  },
];

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

  let artworks = [];
  try {
    artworks = await serverTrpc.artworks.listPublic();
  } catch {
    // DB unavailable at build — render an empty gallery; ISR will refill.
  }

  const items = artworks.map((a) => ({
    title: a.title,
    // Bare slug: getPageUrl() (page-utils) prepends "/gallery" for PostLayout items.
    slug: a.slug,
    excerpt: a.excerpt ?? '',
    featuredImage: a.primaryImage
      ? { url: a.primaryImage.url, altText: a.primaryImage.altText, type: 'ImageBlock' }
      : null,
    colors: 'bg-light-fg-dark',
    styles: { self: { flexDirection: 'row' } },
    __metadata: { modelName: 'PostLayout', urlPath: `/gallery/${a.slug}`, id: a.id },
  }));

  const page = {
    __metadata: { modelName: 'PostFeedLayout', urlPath: '/gallery', id: 'gallery-index' },
    title: 'Gallery',
    enableSearch: false,
    topSections: [],
    bottomSections: withMetadata(BOTTOM_SECTIONS),
    seo: {
      metaTitle: 'Gallery - Maeve Vamy',
      metaDescription:
        'Original fine art by Maeve Vamy — muted seascapes, abstract figurations, and surreal studies in warm, earthy tones.',
      addTitleSuffix: false,
      type: 'Seo',
    },
    pageIndex: 0,
    baseUrlPath: '/gallery',
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
