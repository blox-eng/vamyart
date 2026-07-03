import { describe, expect, it } from 'vitest';
import {
  buildArtworkJsonLd, buildBreadcrumbJsonLd, buildPersonJsonLd, buildWebsiteJsonLd,
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
