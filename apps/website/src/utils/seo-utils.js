import { pickOgImage } from '../lib/ogRotation';

const SITE_NAME = 'Maeve Vamy';

export function seoGenerateMetaTags(page, site) {
    let pageMetaTags = {};

    if (site.defaultMetaTags?.length) {
        site.defaultMetaTags.forEach((metaTag) => {
            pageMetaTags[metaTag.property] = metaTag.content;
        });
    }

    const seoTitle = seoGenerateTitle(page, site);
    const metaDescription = seoGenerateMetaDescription(page, site);
    const ogImage = seoGenerateOgImage(page, site);
    const ogUrl = seoGenerateOgUrl(page, site);
    const ogType = page.__metadata?.modelName === 'PostLayout' ? 'article' : 'website';
    const ogImageAlt = seoGenerateOgImageAlt(page);

    pageMetaTags = {
        ...pageMetaTags,
        ...(seoTitle && { 'og:title': seoTitle }),
        ...(metaDescription && { 'og:description': metaDescription }),
        'og:type': ogType,
        'og:site_name': SITE_NAME,
        ...(ogUrl && { 'og:url': ogUrl }),
        ...(ogImage && { 'og:image': ogImage }),
        ...(ogImage && { 'og:image:alt': ogImageAlt }),
        ...(ogImage && { 'og:image:width': '1200' }),
        ...(ogImage && { 'og:image:height': '630' }),
        'twitter:card': 'summary_large_image',
        ...(seoTitle && { 'twitter:title': seoTitle }),
        ...(metaDescription && { 'twitter:description': metaDescription }),
        ...(ogImage && { 'twitter:image': ogImage }),
    };

    if (page.seo?.metaTags?.length) {
        page.seo?.metaTags.forEach((metaTag) => {
            pageMetaTags[metaTag.property] = metaTag.content;
        });
    }

    let metaTags = [];
    Object.keys(pageMetaTags).forEach((key) => {
        if (pageMetaTags[key] !== null && pageMetaTags[key] !== undefined) {
            metaTags.push({
                property: key,
                content: pageMetaTags[key],
                format: key.startsWith('og') ? 'property' : 'name'
            });
        }
    });

    return metaTags;
}

export function seoGenerateTitle(page, site) {
    let title = page.seo?.metaTitle ? page.seo?.metaTitle : page.title;
    if (site.titleSuffix && page.seo?.addTitleSuffix !== false) {
        title = `${title} - ${site.titleSuffix}`;
    }
    return title;
}

export function seoGenerateMetaDescription(page, site) {
    let metaDescription = null;
    // Gallery posts use the excerpt as the default meta description
    if (page.__metadata?.modelName === 'PostLayout') {
        metaDescription = page.excerpt;
    }
    // page metaDescription field overrides all others
    if (page.seo?.metaDescription) {
        metaDescription = page.seo?.metaDescription;
    }
    return metaDescription;
}

export function seoGenerateOgImage(page, site) {
    let ogImage = null;

    // 1. Gallery posts use the featuredImage as the default og:image
    if (page.__metadata?.modelName === 'PostLayout' && page.featuredImage?.url) {
        ogImage = page.featuredImage.url;
    }

    // 2. Non-PostLayout pages without explicit socialImage get a per-URL rotated artwork
    if (!ogImage) {
        const urlPath = page.__metadata?.urlPath;
        if (urlPath) {
            ogImage = pickOgImage(urlPath);
        }
    }

    // 3. Fall back to site default (final safety net)
    if (!ogImage && site.defaultSocialImage) {
        ogImage = site.defaultSocialImage;
    }

    // 4. page socialImage field overrides all others
    if (page.seo?.socialImage) {
        ogImage = page.seo.socialImage;
    }

    // Resolve to absolute URL when Netlify provides the domain
    const domainUrl = site.env?.URL ? site.env.URL : null;
    if (ogImage && domainUrl) {
        return domainUrl + ogImage;
    }
    return ogImage;
}

function seoGenerateOgUrl(page, site) {
    const domainUrl = site.env?.URL ? site.env.URL : null;
    const urlPath = page.__metadata?.urlPath;
    if (!domainUrl || !urlPath) return null;
    return domainUrl + urlPath;
}

function seoGenerateOgImageAlt(page) {
    if (page.__metadata?.modelName === 'PostLayout' && page.featuredImage?.altText) {
        return page.featuredImage.altText;
    }
    return 'Fine art by Maeve Vamy';
}
