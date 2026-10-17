import { describe, expect, it } from 'vitest';
import { CHECKOUT_COUNTRIES, EU_CHECKOUT_COUNTRIES } from '@vamy/db/checkout-countries';
import {
  buildArtworkJsonLd, buildBreadcrumbJsonLd, buildCollectionJsonLd, buildItemList, buildPersonJsonLd, buildWebsiteJsonLd, escapeJsonLd, wallItemListPieces,
  buildProfilePageJsonLd, buildStoreJsonLd, buildCommissionServiceJsonLd, personId, storeId, siteSameAs,
} from './structured-data';

const ARTIST = 'Maeve Vamy';

describe('buildArtworkJsonLd', () => {
  it('maps artwork fields to VisualArtwork', () => {
    const out = buildArtworkJsonLd({
      title: 'Never', description: 'A study.', year: 2024, medium: 'Oil on canvas',
      image: 'https://a.co/never.jpg', url: 'https://a.co/gallery/never/',
    });
    expect(out['@type']).toBe('VisualArtwork');
    expect(out.name).toBe('Never');
    expect(out.artMedium).toBe('Oil on canvas');
    expect(out.dateCreated).toBe('2024');
    expect(out.image).toBe('https://a.co/never.jpg');
    expect(out.creator).toEqual({ '@type': 'Person', name: ARTIST });
  });
  it('omits absent optional fields', () => {
    const out = buildArtworkJsonLd({ title: 'X', url: 'https://a.co/gallery/x/' });
    expect(out).not.toHaveProperty('artMedium');
    expect(out).not.toHaveProperty('dateCreated');
    expect(out).not.toHaveProperty('image');
    expect(out).not.toHaveProperty('offers');
  });

  it('marks a sold piece as sold out', () => {
    const out = buildArtworkJsonLd({ title: 'X', url: 'https://a.co/gallery/x/', sold: true });
    expect(out.offers).toEqual({ '@type': 'Offer', availability: 'https://schema.org/SoldOut' });
  });
});

describe('buildCollectionJsonLd', () => {
  it('maps collection fields to CollectionPage with hasPart VisualArtwork stubs', () => {
    const out = buildCollectionJsonLd({
      name: 'Seascapes', description: 'A curated set.', url: 'https://a.co/gallery/collections/seascapes/',
      pieces: [
        { name: 'Never', url: 'https://a.co/gallery/never/' },
        { name: 'Tide', url: 'https://a.co/gallery/tide/' },
      ],
    });
    expect(out['@context']).toBe('https://schema.org');
    expect(out['@type']).toBe('CollectionPage');
    expect(out.name).toBe('Seascapes');
    expect(out.description).toBe('A curated set.');
    expect(out.url).toBe('https://a.co/gallery/collections/seascapes/');
    expect(out.hasPart).toEqual([
      { '@type': 'VisualArtwork', name: 'Never', url: 'https://a.co/gallery/never/' },
      { '@type': 'VisualArtwork', name: 'Tide', url: 'https://a.co/gallery/tide/' },
    ]);
  });
  it('omits description when absent and handles an empty piece list', () => {
    const out = buildCollectionJsonLd({ name: 'Empty', url: 'https://a.co/gallery/collections/empty/', pieces: [] });
    expect(out).not.toHaveProperty('description');
    expect(out.hasPart).toEqual([]);
  });
});

describe('buildItemList / collection mainEntity', () => {
  const pieces = [
    { name: 'Never', slug: 'never', image: 'https://a.co/never.jpg' },
    { name: 'Tide', slug: 'tide' },
  ];
  it('builds a positioned ItemList with absolute urls and images', () => {
    const out = buildItemList('https://a.co', pieces);
    expect(out['@type']).toBe('ItemList');
    expect(out.itemListElement[0]).toEqual({
      '@type': 'ListItem', position: 1, url: 'https://a.co/gallery/never/', name: 'Never', image: 'https://a.co/never.jpg',
    });
    expect(out.itemListElement[1].position).toBe(2);
    expect(out.itemListElement[1]).not.toHaveProperty('image');
  });
  it('buildCollectionJsonLd includes the ItemList as mainEntity', () => {
    const out = buildCollectionJsonLd({ name: 'S', url: 'https://a.co/gallery/collections/s/', pieces: [{ name: 'Never', url: 'https://a.co/gallery/never/', image: 'https://a.co/n.jpg' }] });
    expect(out.mainEntity['@type']).toBe('ItemList');
    expect(out.mainEntity.itemListElement[0].position).toBe(1);
    expect(out.mainEntity.itemListElement[0].image).toBe('https://a.co/n.jpg');
  });
});

describe('wallItemListPieces', () => {
  const pieces = [
    { title: 'Never', slug: 'never', image: { url: 'https://s.co/never.jpg' } },
    { title: 'No image', slug: 'blank', image: null },
    { title: 'Tide', slug: 'tide', image: { url: 'https://s.co/tide.jpg' } },
  ];
  it('gives each entry an absolute url, name and image, skipping imageless pieces', () => {
    expect(wallItemListPieces('https://a.co', pieces)).toEqual([
      { name: 'Never', url: 'https://a.co/gallery/never/', image: 'https://s.co/never.jpg' },
      { name: 'Tide', url: 'https://a.co/gallery/tide/', image: 'https://s.co/tide.jpg' },
    ]);
  });
  it('feeds an ItemList whose every entry has url, name and image', () => {
    const out = buildCollectionJsonLd({ name: 'S', url: 'https://a.co/gallery/', pieces: wallItemListPieces('https://a.co', pieces) });
    for (const el of out.mainEntity.itemListElement) {
      expect(el.url).toMatch(/^https:\/\/a\.co\/gallery\//);
      expect(el.name).toBeTruthy();
      expect(el.image).toMatch(/^https:\/\/s\.co\//);
    }
    expect(out.mainEntity.itemListElement.map((e) => e.position)).toEqual([1, 2]);
  });
});

describe('buildBreadcrumbJsonLd', () => {
  it('builds an ordered Home > Gallery > piece trail', () => {
    const out = buildBreadcrumbJsonLd('https://a.co', [
      { name: 'Gallery', path: '/gallery/' }, { name: 'Never', path: '/gallery/never/' },
    ]);
    expect(out['@type']).toBe('BreadcrumbList');
    expect(out.itemListElement).toHaveLength(3);
    expect(out.itemListElement[0]).toMatchObject({ position: 1, name: 'Home', item: 'https://a.co/' });
    expect(out.itemListElement[2]).toMatchObject({ position: 3, name: 'Never', item: 'https://a.co/gallery/never/' });
  });
  it('builds the four-level piece trail without duplicating Home', () => {
    const out = buildBreadcrumbJsonLd('https://vamy.art', [
      { name: 'on the wall', path: '/gallery/' },
      { name: 'Oil', path: '/gallery/collections/oil/' },
      { name: 'Silence', path: '/gallery/silence/' },
    ]);
    expect(out.itemListElement.map((i) => i.name)).toEqual(['Home', 'on the wall', 'Oil', 'Silence']);
    expect(out.itemListElement[2].item).toBe('https://vamy.art/gallery/collections/oil/');
  });
});

describe('buildWebsiteJsonLd / buildPersonJsonLd', () => {
  it('WebSite has name + url', () => {
    expect(buildWebsiteJsonLd('https://a.co')).toMatchObject({ '@type': 'WebSite', url: 'https://a.co', name: ARTIST });
  });
  it('Person includes sameAs when provided', () => {
    const out = buildPersonJsonLd('https://a.co', ['https://instagram.com/vamy']);
    expect(out['@type']).toBe('Person');
    expect(out.name).toBe(ARTIST);
    expect(out.sameAs).toEqual(['https://instagram.com/vamy']);
  });
  it('Person omits sameAs when empty', () => {
    expect(buildPersonJsonLd('https://a.co', [])).not.toHaveProperty('sameAs');
  });
});

describe('escapeJsonLd', () => {
  it('escapes < so a stray </script> cannot break out of the script tag', () => {
    const json = JSON.stringify({ description: '</script><script>alert(1)</script>' });
    const out = escapeJsonLd(json);
    expect(out).not.toContain('</script>');
    expect(out).not.toContain('<');
    expect(out).toContain('\\u003c/script>');
  });
  it('leaves ordinary JSON untouched', () => {
    const json = JSON.stringify({ name: 'Never', year: 2024 });
    expect(escapeJsonLd(json)).toBe(json);
  });
});

describe('artist and store entities', () => {
  const base = 'https://a.co';
  it('Person carries the shared @id, Stara Zagora and sameAs', () => {
    const out = buildPersonJsonLd(base, ['https://instagram.com/vamy']);
    expect(out['@id']).toBe('https://a.co/about/#maeve');
    expect(out.alternateName).toBe('Vamy');
    expect(out.homeLocation.address).toMatchObject({ addressLocality: 'Stara Zagora', addressCountry: 'BG' });
    expect(out.sameAs).toEqual(['https://instagram.com/vamy']);
  });
  it('ProfilePage puts Maeve as its main entity', () => {
    expect(buildProfilePageJsonLd(base, [])['mainEntity']['@id']).toBe(personId(base));
  });
  it('WebSite is published by the store', () => {
    expect(buildWebsiteJsonLd(base).publisher).toEqual({ '@id': storeId(base) });
  });
  it('EU returns: 14 days, exactly the EU checkout countries', () => {
    const eu = buildStoreJsonLd(base).hasMerchantReturnPolicy.find((p) => p['@id'].endsWith('#returns-eu'));
    expect(eu.applicableCountry).toEqual([...EU_CHECKOUT_COUNTRIES]);
    expect(eu.merchantReturnDays).toBe(14);
    expect(eu.returnPolicyCategory).toBe('https://schema.org/MerchantReturnFiniteReturnWindow');
  });
  it('non-EU returns are not offered', () => {
    const non = buildStoreJsonLd(base).hasMerchantReturnPolicy.find((p) => p['@id'].endsWith('#returns-non-eu'));
    expect(non.applicableCountry).toEqual(['CH', 'GB', 'US']);
    expect(non.returnPolicyCategory).toBe('https://schema.org/MerchantReturnNotPermitted');
  });
  it('store advertises no country checkout refuses', () => {
    const countries = JSON.stringify(buildStoreJsonLd(base)).match(/"(?:addressCountry|applicableCountry)":(\[[^\]]*\]|"[A-Z]{2}")/g) ?? [];
    for (const c of countries.join(',').match(/[A-Z]{2}/g)) expect(CHECKOUT_COUNTRIES).toContain(c);
  });
  it('store names the company and its founder', () => {
    const out = buildStoreJsonLd(base);
    expect(out).toMatchObject({ '@type': 'OnlineStore', legalName: 'Мейв Вами ЕООД', taxID: '208627302', founder: { '@id': personId(base) } });
  });
  it('commissions are a service Maeve provides', () => {
    expect(buildCommissionServiceJsonLd(base)).toMatchObject({ '@type': 'Service', provider: { '@id': personId(base) }, url: 'https://a.co/get-a-piece/' });
  });
  it('collection parts credit Maeve', () => {
    const out = buildCollectionJsonLd({ base, name: 'S', url: 'https://a.co/gallery/', pieces: [{ name: 'Never', url: 'https://a.co/gallery/never/' }] });
    expect(out.hasPart[0].creator).toEqual({ '@id': personId(base) });
  });
  it('siteSameAs keeps web profiles once, drops mailto', () => {
    const site = { footer: { socialLinks: [{ url: 'https://instagram.com/x' }, { url: 'mailto:a@b.c' }] }, sameAs: ['https://instagram.com/x', 'https://artsy.net/x'] };
    expect(siteSameAs(site)).toEqual(['https://instagram.com/x', 'https://artsy.net/x']);
  });
});
