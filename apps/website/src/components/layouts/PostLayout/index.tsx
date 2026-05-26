import * as React from 'react';
import dynamic from 'next/dynamic';
import Markdown from 'markdown-to-jsx';

import { getBaseLayoutComponent } from '../../../utils/base-layout';
import { getComponent } from '../../components-registry';
import Link from '../../atoms/Link';
import LazyImage from '../../atoms/LazyImage';
import { formatPrice } from '../../../lib/formatPrice';

// Loaded client-side only — they use tRPC hooks and Supabase realtime
const ProductSelector = dynamic(
    () => import('../../blocks/ProductSelector').then((m) => ({ default: m.ProductSelector })),
    { ssr: false }
);
const BidWidget = dynamic(
    () => import('../../blocks/BidWidget').then((m) => ({ default: m.BidWidget })),
    { ssr: false }
);

export default function PostLayout(props) {
    const { page, site } = props;
    const BaseLayout = getBaseLayoutComponent(page.baseLayout, site.baseLayout);
    const { enableAnnotations = true } = site;
    const { title, markdown_content, bottomSections = [], medium, dimensions, price, pieceId, prevPost, nextPost } = page;

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
                                    {...(enableAnnotations && { 'data-sb-field-path': 'featuredImage.url' })}
                                />
                            </div>
                        )}

                        {/* Right column — details */}
                        <div className="space-y-6">
                            <Link
                                href="/gallery"
                                className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <span aria-hidden="true">←</span> Back to gallery
                            </Link>
                            <h1 {...(enableAnnotations && { 'data-sb-field-path': 'title' })}>{title}</h1>
                            {pieceId && (
                                <p className="text-xs uppercase tracking-widest text-gray-400 -mt-4">
                                    {pieceId}
                                </p>
                            )}

                            {(medium || dimensions || price) && (
                                <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-gray-500 mb-8">
                                    {medium && (
                                        <div><dt className="sr-only">Medium</dt><dd>{medium}</dd></div>
                                    )}
                                    {dimensions && (
                                        <div><dt className="sr-only">Dimensions</dt><dd>{dimensions}</dd></div>
                                    )}
                                    {price && formatPrice(price) && (
                                        <div><dt className="sr-only">Price</dt><dd>{formatPrice(price)}</dd></div>
                                    )}
                                </dl>
                            )}

                            {artworkSlug && (
                                <Link
                                    href={`/get-a-piece?piece=${artworkSlug}`}
                                    className="inline-block text-sm font-medium uppercase tracking-wide underline underline-offset-4 hover:text-gray-600"
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
                                    <ProductSelector artworkSlug={artworkSlug} />
                                    <div className="pt-2 text-center">
                                        <Link
                                            href={`/get-a-piece?piece=${artworkSlug}`}
                                            className="inline-block text-sm font-medium underline underline-offset-4 hover:text-gray-600"
                                        >
                                            Or inquire about this piece
                                        </Link>
                                    </div>
                                </div>
                            )}

                            {(prevPost || nextPost) && (
                                <nav aria-label="Artwork navigation" className="flex items-center justify-between pt-8 border-t border-gray-200">
                                    {prevPost ? (
                                        <Link
                                            href={prevPost.urlPath}
                                            className="group flex flex-col items-start gap-0.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
                                        >
                                            <span className="text-xs uppercase tracking-widest text-gray-400 group-hover:text-gray-600 transition-colors">← Previous</span>
                                            <span className="font-light">{prevPost.title}</span>
                                        </Link>
                                    ) : <span />}
                                    {nextPost ? (
                                        <Link
                                            href={nextPost.urlPath}
                                            className="group flex flex-col items-end gap-0.5 text-sm text-gray-500 hover:text-gray-900 transition-colors text-right"
                                        >
                                            <span className="text-xs uppercase tracking-widest text-gray-400 group-hover:text-gray-600 transition-colors">Next →</span>
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
