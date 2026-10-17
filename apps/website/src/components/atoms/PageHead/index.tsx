import * as React from 'react';
import Head from 'next/head';
import { absoluteUrl, formatTitle, resolveSiteUrl } from '../../../utils/seo-utils';
import { escapeJsonLd } from '../../../utils/structured-data';

type PageHeadProps = {
    title: string;
    description: string | null;
    canonicalPath: string;
    ogImage: string | null;
    ogImageAlt?: string | null;
    ogImageWidth?: number | null;
    ogImageHeight?: number | null;
    ogType?: 'website' | 'article';
    // Pinterest product pin: makes the page og:type product.
    ogProduct?: { amount: string; currency: string; availability: string } | null;
    jsonLd?: object[];
    site?: { env?: { URL?: string }; favicon?: string };
};

// Single source of the document head. Every tag carries a `key` so Next dedupes
// it against any other Head on the page (the last one rendered wins).
export default function PageHead({ title, description, canonicalPath, ogImage, ogImageAlt, ogImageWidth, ogImageHeight, ogType = 'website', ogProduct, jsonLd = [], site }: PageHeadProps) {
    const base = resolveSiteUrl(site ?? {});
    const canonical = absoluteUrl(base, canonicalPath.endsWith('/') ? canonicalPath : `${canonicalPath}/`);
    const fullTitle = formatTitle(title);
    const image = ogImage ? absoluteUrl(base, ogImage) : null;

    return (
        <Head>
            <title key="title">{fullTitle}</title>
            <meta key="viewport" name="viewport" content="width=device-width, initial-scale=1" />
            {description && <meta key="description" name="description" content={description} />}

            <link key="canonical" rel="canonical" href={canonical} />
            <meta key="og:title" property="og:title" content={fullTitle} />
            {description && <meta key="og:description" property="og:description" content={description} />}
            <meta key="og:url" property="og:url" content={canonical} />
            <meta key="og:type" property="og:type" content={ogProduct ? 'product' : ogType} />
            <meta key="og:site_name" property="og:site_name" content="Maeve Vamy" />
            {image && <meta key="og:image" property="og:image" content={image} />}
            {image && ogImageWidth && ogImageHeight && (
                <>
                    <meta key="og:image:width" property="og:image:width" content={String(ogImageWidth)} />
                    <meta key="og:image:height" property="og:image:height" content={String(ogImageHeight)} />
                </>
            )}
            {ogProduct && (
                <>
                    <meta key="product:price:amount" property="product:price:amount" content={ogProduct.amount} />
                    <meta key="product:price:currency" property="product:price:currency" content={ogProduct.currency} />
                    <meta key="product:availability" property="product:availability" content={ogProduct.availability} />
                </>
            )}
            <meta key="twitter:card" name="twitter:card" content="summary_large_image" />
            <meta key="twitter:title" name="twitter:title" content={fullTitle} />
            {description && <meta key="twitter:description" name="twitter:description" content={description} />}
            {image && ogImageAlt && <meta key="og:image:alt" property="og:image:alt" content={ogImageAlt} />}
            {image && <meta key="twitter:image" name="twitter:image" content={image} />}
            <link key="icon" rel="icon" href={site?.favicon ?? '/images/favicon.svg'} />
            {jsonLd.map((data, i) => (
                <script
                    key={`ld-${i}`}
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: escapeJsonLd(JSON.stringify(data)) }}
                />
            ))}
        </Head>
    );
}
