import { CHECKOUT_COUNTRIES, EU_CHECKOUT_COUNTRIES, NON_EU_CHECKOUT_COUNTRIES } from '@vamy/db/checkout-countries';

const ARTIST_NAME = 'Maeve Vamy';
const HOME = { addressLocality: 'Stara Zagora', addressCountry: 'BG' };

export const personId = (base) => `${base}/about/#maeve`;
export const storeId = (base) => `${base}/#store`;
export const returnPolicyIds = (base) => [`${base}/#returns-eu`, `${base}/#returns-non-eu`];
export const shippingId = (base) => `${base}/#shipping`;

// Escape `<` in serialized JSON-LD so a stray `</script>` in DB-sourced
// content (e.g. an artwork title/description) can't break out of the
// surrounding <script type="application/ld+json"> tag.
export function escapeJsonLd(json) {
    return json.replace(/</g, '\\u003c');
}

export function buildItemList(base, pieces = []) {
    return {
        '@type': 'ItemList',
        itemListElement: pieces.map((p, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: p.url ?? `${base}/gallery/${p.slug}/`,
            name: p.name,
            ...(p.image ? { image: p.image } : {}),
        })),
    };
}

// Wall pieces as JSON-LD list entries: absolute url, name and image. Imageless pieces
// are skipped, as on the wall itself.
export function wallItemListPieces(base, pieces = []) {
    return pieces
        .filter((p) => p.image?.url)
        .map((p) => ({ name: p.title, url: `${base}/gallery/${p.slug}/`, image: p.image.url }));
}

export function buildCollectionJsonLd({ base, name, description, url, pieces = [] }) {
    return {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name,
        url,
        ...(description ? { description } : {}),
        hasPart: pieces.map((p) => ({
            '@type': 'VisualArtwork',
            name: p.name,
            url: p.url,
            ...(base ? { creator: { '@id': personId(base) } } : {}),
        })),
        mainEntity: buildItemList('', pieces),
    };
}

export function buildBreadcrumbJsonLd(base, crumbs) {
    const items = [{ name: 'Home', path: '/' }, ...crumbs];
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((c, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: c.name,
            item: base + (c.path === '/' ? '/' : c.path),
        })),
    };
}

export function buildWebsiteJsonLd(base) {
    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: ARTIST_NAME,
        url: base,
        publisher: { '@id': storeId(base) },
    };
}

export function buildPersonJsonLd(base, sameAs = []) {
    return {
        '@context': 'https://schema.org',
        '@type': 'Person',
        '@id': personId(base),
        name: ARTIST_NAME,
        alternateName: 'Vamy',
        url: `${base}/about/`,
        image: `${base}/images/maeve-studio.jpg`,
        jobTitle: 'Painter',
        homeLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', ...HOME } },
        nationality: { '@type': 'Country', name: 'Bulgaria' },
        ...(sameAs.length ? { sameAs } : {}),
    };
}

export function buildProfilePageJsonLd(base, sameAs = []) {
    const { '@context': context, ...person } = buildPersonJsonLd(base, sameAs);
    return { '@context': context, '@type': 'ProfilePage', url: `${base}/about/`, mainEntity: person };
}

// The shop behind the pieces, with the policies every offer points to (terms.md).
export function buildStoreJsonLd(base) {
    const [euReturns, nonEuReturns] = returnPolicyIds(base);
    return {
        '@context': 'https://schema.org',
        '@type': 'OnlineStore',
        '@id': storeId(base),
        name: 'Vamy',
        legalName: 'Мейв Вами ЕООД',
        url: base,
        logo: `${base}/images/favicon.svg`,
        email: 'maeve@vamy.art',
        taxID: '208627302',
        address: { '@type': 'PostalAddress', ...HOME },
        founder: { '@id': personId(base) },
        hasMerchantReturnPolicy: [
            {
                '@type': 'MerchantReturnPolicy',
                '@id': euReturns,
                applicableCountry: [...EU_CHECKOUT_COUNTRIES],
                returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
                merchantReturnDays: 14,
                returnMethod: 'https://schema.org/ReturnByMail',
                returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
                refundType: 'https://schema.org/FullRefund',
            },
            {
                // Outside the EU only damaged or misrepresented pieces come back,
                // which schema.org can't say; claim no returns rather than too many.
                '@type': 'MerchantReturnPolicy',
                '@id': nonEuReturns,
                applicableCountry: [...NON_EU_CHECKOUT_COUNTRIES],
                returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted',
            },
        ],
        hasShippingService: {
            '@type': 'ShippingService',
            '@id': shippingId(base),
            shippingConditions: {
                '@type': 'ShippingConditions',
                shippingDestination: CHECKOUT_COUNTRIES.map((addressCountry) => ({ '@type': 'DefinedRegion', addressCountry })),
            },
        },
    };
}

export function buildCommissionServiceJsonLd(base) {
    return {
        '@context': 'https://schema.org',
        '@type': 'Service',
        name: 'Commissioned painting',
        serviceType: 'Commissioned painting',
        provider: { '@id': personId(base) },
        areaServed: 'Worldwide',
        url: `${base}/get-a-piece/`,
    };
}

// Maeve's profiles elsewhere: the footer's web links plus site.json's sameAs.
export function siteSameAs(site) {
    const footer = Array.isArray(site?.footer?.socialLinks) ? site.footer.socialLinks.map((l) => l.url) : [];
    const extra = Array.isArray(site?.sameAs) ? site.sameAs : [];
    return [...new Set([...footer, ...extra].filter((u) => /^https?:\/\//.test(u ?? '')))];
}
