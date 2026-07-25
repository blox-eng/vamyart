const ARTIST_NAME = 'Maeve Vamy';

// Escape `<` in serialized JSON-LD so a stray `</script>` in DB-sourced
// content (e.g. an artwork title/description) can't break out of the
// surrounding <script type="application/ld+json"> tag.
export function escapeJsonLd(json) {
    return json.replace(/</g, '\\u003c');
}

export function buildArtworkJsonLd({ title, description, year, medium, image, url }) {
    return {
        '@context': 'https://schema.org',
        '@type': 'VisualArtwork',
        name: title,
        url,
        creator: { '@type': 'Person', name: ARTIST_NAME },
        ...(description ? { description } : {}),
        ...(year ? { dateCreated: String(year) } : {}),
        ...(medium ? { artMedium: medium } : {}),
        ...(image ? { image } : {}),
    };
}

export function buildCollectionJsonLd({ name, description, url, pieces = [] }) {
    return {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name,
        url,
        ...(description ? { description } : {}),
        hasPart: pieces.map((p) => ({ '@type': 'VisualArtwork', name: p.name, url: p.url })),
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
    return { '@context': 'https://schema.org', '@type': 'WebSite', name: ARTIST_NAME, url: base };
}

export function buildPersonJsonLd(base, sameAs = []) {
    return {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: ARTIST_NAME,
        url: base,
        jobTitle: 'Fine artist',
        ...(sameAs.length ? { sameAs } : {}),
    };
}
