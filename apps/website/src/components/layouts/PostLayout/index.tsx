import * as React from 'react';
import dynamic from 'next/dynamic';
import Markdown from 'markdown-to-jsx';

import { getBaseLayoutComponent } from '../../../utils/base-layout';
import { getComponent } from '../../components-registry';
import Link from '../../atoms/Link';
import LazyImage from '../../atoms/LazyImage';
import { SoldMark } from '../../gallery/SoldDot';
import { PaintSplashes } from '../../gallery/PaintSplashes';
import { ProductSelector } from '../../blocks/ProductSelector';

// Client-side only: Supabase realtime. ProductSelector renders on the server from
// the page's products, so prices are in the HTML crawlers read.
const BidWidget = dynamic(
    () => import('../../blocks/BidWidget').then((m) => ({ default: m.BidWidget })),
    { ssr: false }
);

export default function PostLayout(props) {
    const { page, site } = props;
    const BaseLayout = getBaseLayoutComponent(page.baseLayout, site.baseLayout);
    const { enableAnnotations = true } = site;
    const { title, markdown_content, bottomSections = [], medium, dimensions, prevPost, nextPost, sold, soldAt, products, palette } = page;

    // Extract artwork slug from URL path — e.g. /gallery/whispers → whispers
    const urlPath = page.__metadata?.urlPath ?? '';
    const artworkSlug = urlPath.split('/').filter(Boolean).pop() ?? null;

    const featuredImageUrl = page.featuredImage?.url;
    const featuredImageAlt = page.featuredImage?.altText || title;

    return (
        <BaseLayout page={page} site={site}>
            <main id="main" className="sb-layout sb-post-layout">
                <article className="px-4 py-16 sm:py-28">
                    <div className="mx-auto max-w-screen-2xl lg:grid lg:grid-cols-2 lg:gap-12">
                        {/* Left column — artwork image */}
                        {featuredImageUrl && (
                            <div className="lg:sticky lg:top-8 lg:self-start mb-8 lg:mb-0">
                                <LazyImage
                                    src={featuredImageUrl}
                                    alt={featuredImageAlt}
                                    className="w-full"
                                    imgClassName="h-auto"
                                    loading="eager"
                                    fetchPriority="high"
                                    sizes="(min-width: 1024px) 50vw, 100vw"
                                    width={page.featuredImage?.width}
                                    height={page.featuredImage?.height}
                                    {...(enableAnnotations && { 'data-sb-field-path': 'featuredImage.url' })}
                                />
                                {sold && artworkSlug && (
                                    <SoldMark soldAt={soldAt ?? null} commissionHref={`/get-a-piece?piece=${artworkSlug}`} />
                                )}
                                {palette?.swatches?.length > 0 && <PaintSplashes palette={palette} />}
                            </div>
                        )}

                        {/* Right column — details */}
                        <div className="space-y-6">
                            <Link
                                href="/gallery"
                                className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-faint hover:text-muted transition-colors"
                            >
                                <span aria-hidden="true">←</span> Back to gallery
                            </Link>
                            <h1 {...(enableAnnotations && { 'data-sb-field-path': 'title' })}>{title}</h1>
                            {(medium || dimensions) && (
                                <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted mb-8">
                                    {medium && (
                                        <div><dt className="sr-only">Medium</dt><dd>{medium}</dd></div>
                                    )}
                                    {dimensions && (
                                        <div><dt className="sr-only">Dimensions</dt><dd>{dimensions}</dd></div>
                                    )}
                                </dl>
                            )}

                            {artworkSlug && !sold && (
                                <Link
                                    href={`/get-a-piece?piece=${artworkSlug}`}
                                    className="inline-block text-sm font-medium uppercase tracking-wide underline underline-offset-4 hover:text-muted"
                                >
                                    Inquire
                                </Link>
                            )}

                            {markdown_content && (
                                <Markdown
                                    options={{ forceBlock: true }}
                                    className="sb-markdown"
                                    {...(enableAnnotations && { 'data-sb-field-path': 'markdown_content' })}
                                >
                                    {markdown_content}
                                </Markdown>
                            )}

                            {/* Commerce widgets — self-hide when no active auction or products */}
                            {artworkSlug && (
                                <div className="space-y-4">
                                    <BidWidget artworkSlug={artworkSlug} />
                                    <ProductSelector artworkSlug={artworkSlug} initialProducts={products} />
                                    {!sold && (
                                        <div className="pt-2 text-center">
                                            <Link
                                                href={`/get-a-piece?piece=${artworkSlug}`}
                                                className="inline-block text-sm font-medium underline underline-offset-4 hover:text-muted"
                                            >
                                                Or inquire about this piece
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            )}

                            {(prevPost || nextPost) && (
                                <nav aria-label="Artwork navigation" className="flex items-center justify-between pt-8 border-t border-hair">
                                    {prevPost ? (
                                        <Link
                                            href={prevPost.urlPath}
                                            className="group flex flex-col items-start gap-0.5 text-sm text-muted hover:text-ink transition-colors"
                                        >
                                            <span className="text-xs uppercase tracking-widest text-faint group-hover:text-muted transition-colors">← Previous</span>
                                            <span className="font-light">{prevPost.title}</span>
                                        </Link>
                                    ) : <span />}
                                    {nextPost ? (
                                        <Link
                                            href={nextPost.urlPath}
                                            className="group flex flex-col items-end gap-0.5 text-sm text-muted hover:text-ink transition-colors text-right"
                                        >
                                            <span className="text-xs uppercase tracking-widest text-faint group-hover:text-muted transition-colors">Next →</span>
                                            <span className="font-light">{nextPost.title}</span>
                                        </Link>
                                    ) : <span />}
                                </nav>
                            )}
                        </div>
                    </div>
                </article>

                {bottomSections.length > 0 && (
                    <div {...(enableAnnotations && { 'data-sb-field-path': 'bottomSections' })}>
                        {bottomSections.map((section, index) => {
                            const Component = getComponent(section.__metadata.modelName);
                            if (!Component) {
                                throw new Error(`no component matching the page section's model name: ${section.__metadata.modelName}`);
                            }
                            return (
                                <Component
                                    key={index}
                                    {...section}
                                    enableAnnotations={enableAnnotations}
                                    {...(enableAnnotations && { 'data-sb-field-path': `bottomSections.${index}` })}
                                />
                            );
                        })}
                    </div>
                )}
            </main>
        </BaseLayout>
    );
}
