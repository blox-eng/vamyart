import { CHECKOUT_COUNTRIES } from '@vamy/db/checkout-countries';
import { resolveShipping } from '@vamy/db/shipping';
import { isVariantSold } from './variant-sold';
import { personId, returnPolicyIds, storeId } from './structured-data';

const SCHEMA = 'https://schema.org/';
const ARTIST_NAME = 'Maeve Vamy';

const cm = (value) => ({ '@type': 'QuantitativeValue', value, unitCode: 'CMT' });
const money = (price) => Number(price).toFixed(2);

// What a buyer can actually check out: in stock, not sold, and not the original
// while it is being auctioned (no auction variant recorded = the original).
function purchasableVariants(products, activeAuction) {
    return products.flatMap((p) =>
        p.variants
            .filter((v) => !isVariantSold(v) && v.stockQuantity > 0)
            .filter((v) => !activeAuction || (activeAuction.productVariantId ? v.id !== activeAuction.productVariantId : !v.isOriginal))
            .map((v) => ({ ...v, shippingMethod: p.shippingMethod })),
    );
}

export function buildImageObject(base, { url, width, height, alt, year }) {
    return {
        '@type': 'ImageObject',
        contentUrl: url,
        ...(width && height ? { width, height } : {}),
        ...(alt ? { caption: alt } : {}),
        creator: { '@id': personId(base) },
        creditText: ARTIST_NAME,
        copyrightNotice: `© ${year ?? new Date().getUTCFullYear()} ${ARTIST_NAME}`,
        license: `${base}/terms/#copyright`,
        acquireLicensePage: `${base}/get-a-piece/`,
    };
}

function shippingDetails(variant) {
    const shipping = resolveShipping(variant.shippingMethod);
    if (shipping.type === 'custom' || (shipping.type === 'paid' && shipping.cost == null)) return null;
    return {
        '@type': 'OfferShippingDetails',
        shippingRate: { '@type': 'MonetaryAmount', value: shipping.type === 'free' ? 0 : shipping.cost, currency: 'EUR' },
        shippingDestination: CHECKOUT_COUNTRIES.map((addressCountry) => ({ '@type': 'DefinedRegion', addressCountry })),
        deliveryTime: {
            '@type': 'ShippingDeliveryTime',
            handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: variant.isOriginal ? 30 : 7, unitCode: 'DAY' },
        },
    };
}

function offerFor(base, url, variant) {
    const shipping = shippingDetails(variant);
    return {
        '@type': 'Offer',
        price: money(variant.price),
        priceCurrency: 'EUR',
        availability: `${SCHEMA}InStock`,
        itemCondition: `${SCHEMA}NewCondition`,
        url,
        seller: { '@id': storeId(base) },
        hasMerchantReturnPolicy: returnPolicyIds(base).map((id) => ({ '@id': id })),
        ...(shipping ? { shippingDetails: shipping } : {}),
    };
}

export function buildPieceJsonLd(base, { url, slug, title, description, year, medium, dimensionsCm, image, products = [], activeAuction, sold }) {
    const artwork = {
        '@context': 'https://schema.org',
        '@id': `${url}#artwork`,
        name: title,
        url,
        ...(description ? { description } : {}),
        creator: { '@id': personId(base) },
        artform: 'Painting',
        ...(medium?.trim() ? { artMedium: medium.trim() } : {}),
        ...(year ? { dateCreated: String(year) } : {}),
        ...(dimensionsCm ? { width: cm(dimensionsCm.widthCm), height: cm(dimensionsCm.heightCm) } : {}),
        ...(image?.url ? { image: buildImageObject(base, { ...image, year }) } : {}),
    };

    const variants = purchasableVariants(products, activeAuction);
    if (variants.length === 0) {
        return sold
            ? { ...artwork, '@type': 'VisualArtwork', offers: { '@type': 'Offer', availability: `${SCHEMA}SoldOut` } }
            : { ...artwork, '@type': 'VisualArtwork' };
    }

    const brand = { '@type': 'Brand', name: 'Vamy' };
    if (variants.length === 1 && variants[0].isOriginal) {
        return { ...artwork, '@type': ['VisualArtwork', 'Product'], brand, sku: variants[0].id, offers: offerFor(base, url, variants[0]) };
    }
    return {
        ...artwork,
        '@type': ['VisualArtwork', 'ProductGroup'],
        brand,
        productGroupID: slug,
        variesBy: `${SCHEMA}size`,
        hasVariant: variants.map((v) => ({
            '@type': 'Product',
            name: `${title} — ${v.name}`,
            sku: v.id,
            size: v.attributes?.size ?? v.name,
            ...(image?.url ? { image: image.url } : {}),
            ...(v.isOriginal ? {} : { artEdition: 'Print' }),
            offers: offerFor(base, url, v),
        })),
    };
}

// Pinterest product pins: the lowest price a buyer can pay today.
export function pieceOgProductTags(products = [], activeAuction = null) {
    const prices = purchasableVariants(products, activeAuction).map((v) => Number(v.price));
    if (prices.length === 0) return null;
    return { amount: money(Math.min(...prices)), currency: 'EUR', availability: 'in stock' };
}
