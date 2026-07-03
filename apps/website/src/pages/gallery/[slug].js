import React from 'react';
import Head from 'next/head';
import { allContent } from '../../utils/local-content';
import { getComponent } from '../../components/components-registry';
import { seoGenerateTitle, seoGenerateMetaTags, seoGenerateMetaDescription, seoGenerateCanonicalUrl } from '../../utils/seo-utils';
import { buildHeroPreload } from '../../utils/netlify-image';
import { appRouter } from '@vamy/db/trpc';

const serverTrpc = appRouter.createCaller({ userId: null });

function toJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function Page({ page, site }) {
  const PageLayout = getComponent('PostLayout');
  const title = seoGenerateTitle(page, site);
  const metaTags = seoGenerateMetaTags(page, site);
  const metaDescription = seoGenerateMetaDescription(page, site);
  const canonicalUrl = seoGenerateCanonicalUrl(page, site);
  const heroPreload = page.featuredImage?.url
    ? buildHeroPreload(page.featuredImage.url, { sizes: '(min-width: 1024px) 50vw, 100vw' })
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
      </Head>
      <PageLayout page={page} site={site} />
    </>
  );
}

export async function getStaticPaths() {
  let slugs = [];
  try {
    const list = await serverTrpc.artworks.listPublic();
    slugs = list.map((a) => ({ params: { slug: a.slug } }));
  } catch {
    // DB unavailable at build — rely on fallback: 'blocking'.
  }
  return { paths: slugs, fallback: 'blocking' };
}

export async function getStaticProps({ params }) {
  const { props: { site } } = allContent();

  let artwork = null;
  let list = [];
  try {
    [artwork, list] = await Promise.all([
      serverTrpc.artworks.getBySlug({ slug: params.slug }),
      serverTrpc.artworks.listPublic(),
    ]);
  } catch {
    // fall through to notFound below
  }
  if (!artwork) {
    return { notFound: true, revalidate: 3600 };
  }

  const idx = list.findIndex((a) => a.slug === artwork.slug);
  const prevPost = idx > 0 ? { title: list[idx - 1].title, urlPath: `/gallery/${list[idx - 1].slug}` } : null;
  const nextPost =
    idx >= 0 && idx < list.length - 1
      ? { title: list[idx + 1].title, urlPath: `/gallery/${list[idx + 1].slug}` }
      : null;

  const page = {
    __metadata: { modelName: 'PostLayout', urlPath: `/gallery/${artwork.slug}`, id: artwork.id },
    title: artwork.title,
    artworkSlug: artwork.slug,
    excerpt: artwork.excerpt ?? '',
    markdown_content: artwork.description ?? '',
    medium: artwork.medium ?? null,
    dimensions: artwork.dimensions ?? null,
    featuredImage: artwork.primaryImage
      ? { url: artwork.primaryImage.url, altText: artwork.primaryImage.altText, type: 'ImageBlock' }
      : null,
    bottomSections: [],
    prevPost,
    nextPost,
    seo: {
      metaTitle: artwork.seoTitle ?? artwork.title,
      metaDescription: artwork.seoDescription ?? artwork.excerpt ?? '',
      socialImage: artwork.primaryImage?.url ?? null,
      type: 'Seo',
    },
  };

  return { props: { page: toJson(page), site: toJson(site) }, revalidate: 3600 };
}

export default Page;
