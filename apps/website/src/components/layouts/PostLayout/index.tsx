import * as React from 'react';
import dynamic from 'next/dynamic';
import Markdown from 'markdown-to-jsx';

import { getBaseLayoutComponent } from '../../../utils/base-layout';
import { getComponent } from '../../components-registry';
import Link from '../../atoms/Link';

// Loaded client-side only — they use tRPC hooks and Supabase realtime
const ProductSelector = dynamic(
    () => import('../../blocks/ProductSelector').then((m) => ({ default: m.ProductSelector })),
    { ssr: false }
);
const BidWidget = dynamic(
    () => import('../../blocks/BidWidget').then((m) => ({ default: m.BidWidget })),
    { ssr: false }
);
const ArtworkDetails = dynamic(
    () => import('../../blocks/ArtworkDetails').then((m) => ({ default: m.ArtworkDetails })),
    { ssr: false }
);

export default function PostLayout(props) {
    const { page, site } = props;
    const BaseLayout = getBaseLayoutComponent(page.baseLayout, site.baseLayout);
    const { enableAnnotations = true } = site;
    const { title, markdown_content, bottomSections = [] } = page;

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
                                <img
                                    src={featuredImageUrl}
                                    alt={featuredImageAlt}
                                    className="w-full h-auto"
                                    {...(enableAnnotations && { 'data-sb-field-path': 'featuredImage.url' })}
                                />
                            </div>
                        )}

                        {/* Right column — details */}
                        <div className="space-y-6">
                            <h1 {...(enableAnnotations && { 'data-sb-field-path': 'title' })}>{title}</h1>

                            {artworkSlug && <ArtworkDetails slug={artworkSlug} />}

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
                                </div>
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
