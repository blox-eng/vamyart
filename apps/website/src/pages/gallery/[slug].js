import React from 'react';
import Head from 'next/head';
import { allContent } from '../../utils/local-content';
import { getComponent } from '../../components/components-registry';
import { absoluteUrl, ogImageUrl, resolveSiteUrl } from '../../utils/seo-utils';
import { buildHeroPreload } from '../../utils/netlify-image';
import { buildArtworkJsonLd, buildBreadcrumbJsonLd } from '../../utils/structured-data';
import PageHead from '../../components/atoms/PageHead';
import { appRouter } from '@vamy/db/trpc';

const serverTrpc = appRouter.createCaller({ userId: null });

function toJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function Page({ page, site, collection }) {
  const PageLayout = getComponent('PostLayout');
  const base = resolveSiteUrl(site);
  const canonicalPath = `/gallery/${page.artworkSlug}/`;
  const heroPreload = page.featuredImage?.url
    ? buildHeroPreload(page.featuredImage.url, { sizes: '(min-width: 1024px) 50vw, 100vw' })
    : null;
  const artworkLd = buildArtworkJsonLd({
    title: page.title, description: page.excerpt, year: page.year, medium: page.medium,
    image: page.featuredImage?.url, url: absoluteUrl(base, canonicalPath),
  });
  const breadcrumbLd = buildBreadcrumbJsonLd(base, [
    { name: 'on the wall', path: '/gallery/' },
    ...(collection ? [{ name: collection.title, path: `/gallery/collections/${collection.slug}/` }] : []),
    { name: page.title, path: canonicalPath },
  ]);
  return (
    <>
      <PageHead
        title={page.seo.metaTitle}
        description={page.seo.metaDescription || null}
        canonicalPath={canonicalPath}
        ogImage={page.featuredImage ? ogImageUrl(page.featuredImage.url, base) : null}
        ogType="article"
        ogImageAlt={page.featuredImage?.altText ?? null}
        jsonLd={[artworkLd, breadcrumbLd]}
        site={site}
      />
      {heroPreload && (
        <Head>
          <link
            key="hero-preload"
            rel="preload"
            as="image"
            href={heroPreload.href}
            imageSrcSet={heroPreload.imageSrcSet}
            imageSizes={heroPreload.imageSizes}
            fetchPriority="high"
          />
        </Head>
      )}
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

  let artwork;
  let wall;
  let listing;
  try {
    [artwork, wall, listing] = await Promise.all([
      serverTrpc.artworks.getBySlug({ slug: params.slug }),
      serverTrpc.gallery.wall({}),
      serverTrpc.artworks.listPublic(),
    ]);
  } catch (err) {
    if (err?.code === 'NOT_FOUND') return { notFound: true, revalidate: 3600 };
    throw err;
  }
  if (!artwork) {
    return { notFound: true, revalidate: 3600 };
  }

  const { pieces, filters } = wall;
  const idx = pieces.findIndex((p) => p.slug === artwork.slug);
  const toNav = (p) => ({ title: p.title, urlPath: `/gallery/${p.slug}` });
  const prevPost = idx > 0 ? toNav(pieces[idx - 1]) : null;
  const nextPost = idx >= 0 && idx < pieces.length - 1 ? toNav(pieces[idx + 1]) : null;

  const memberOf = listing.find((a) => a.slug === artwork.slug)?.collectionSlugs ?? [];
  const collection = filters.find((f) => memberOf.includes(f.slug)) ?? null;

  const page = {
    __metadata: { modelName: 'PostLayout', urlPath: `/gallery/${artwork.slug}`, id: artwork.id },
    title: artwork.title,
    artworkSlug: artwork.slug,
    excerpt: artwork.excerpt ?? '',
    markdown_content: artwork.description ?? '',
    medium: artwork.medium ?? null,
    dimensions: artwork.dimensions ?? null,
    year: artwork.year ?? null,
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

  return { props: { page: toJson(page), site: toJson(site), collection }, revalidate: 3600 };
}

export default Page;
