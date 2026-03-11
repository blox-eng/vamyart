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

function ArtworkDetailsStatic({ product }: { product: any }) {
    const allVariants = (product.variants ?? []) as any[];
    const cheapest = allVariants
        .filter((v: any) => v.available && v.price)
        .sort((a: any, b: any) => Number(a.price) - Number(b.price))[0];
    const hasAvailable = allVariants.some((v: any) => v.available);
    const attrs = (allVariants[0]?.attributes ?? {}) as Record<string, string>;
    const medium = attrs.medium ?? "";
    const dimensions = attrs.dimensions ?? "";

    return (
        <div className="space-y-2">
            {medium && <p className="text-sm text-gray-500">{medium}</p>}
            {dimensions && <p className="text-sm text-gray-500">{dimensions}</p>}
            {cheapest ? (
                <p className="text-lg font-light">€{Number(cheapest.price).toLocaleString()}</p>
            ) : (
                <p className="text-sm text-gray-400 italic">Price on request</p>
            )}
            <p className="text-sm flex items-center gap-1.5">
                <span className={`inline-block w-2 h-2 rounded-full ${hasAvailable ? "bg-green-500" : "bg-gray-400"}`} />
                <span className={hasAvailable ? "text-green-700" : "text-gray-400"}>
                    {hasAvailable ? "Available" : "Sold"}
                </span>
            </p>
        </div>
    );
}

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

                            {page.artworkProduct && <ArtworkDetailsStatic product={page.artworkProduct} />}

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
