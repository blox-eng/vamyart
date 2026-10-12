import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeTrailingSlash, resolveSiteUrl, seoGenerateCanonicalUrl, seoGenerateMetaTags, seoGenerateOgImage, formatTitle, absoluteUrl, ogImageUrl } from './seo-utils';

// direnv/.env.local export NEXT_PUBLIC_SITE_URL for local dev; stub it out so the
// "no host available" cases are deterministic regardless of the ambient shell env.
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('normalizeTrailingSlash', () => {
  it('keeps root as "/"', () => expect(normalizeTrailingSlash('/')).toBe('/'));
  it('adds a trailing slash', () => expect(normalizeTrailingSlash('/gallery/never')).toBe('/gallery/never/'));
  it('collapses a duplicate trailing slash', () => expect(normalizeTrailingSlash('/about//')).toBe('/about/'));
  it('leaves an already-normalized path', () => expect(normalizeTrailingSlash('/about/')).toBe('/about/'));
});

describe('resolveSiteUrl', () => {
  it('prefers site.env.URL', () => expect(resolveSiteUrl({ env: { URL: 'https://a.co' } })).toBe('https://a.co'));
  it('strips a trailing slash from the base', () => expect(resolveSiteUrl({ env: { URL: 'https://a.co/' } })).toBe('https://a.co'));
  it('falls back to the production origin when no host is available', () => expect(resolveSiteUrl({})).toBe('https://vamy.art'));
});

describe('seoGenerateCanonicalUrl', () => {
  it('joins base + normalized urlPath', () => {
    const page = { __metadata: { urlPath: '/gallery/never' } };
    expect(seoGenerateCanonicalUrl(page, { env: { URL: 'https://a.co' } })).toBe('https://a.co/gallery/never/');
  });
  it('uses the production origin without a host', () => {
    expect(seoGenerateCanonicalUrl({ __metadata: { urlPath: '/about' } }, {})).toBe('https://vamy.art/about/');
  });
});

describe('seoGenerateMetaTags og:url', () => {
  function findOgUrl(metaTags) {
    return metaTags.find((m) => m.property === 'og:url')?.content;
  }

  it('matches canonical for a gallery-style page', () => {
    const page = { __metadata: { urlPath: '/gallery/never' }, title: 'Never' };
    const site = { env: { URL: 'https://a.co' } };
    const metaTags = seoGenerateMetaTags(page, site);
    expect(findOgUrl(metaTags)).toBe('https://a.co/gallery/never/');
    expect(findOgUrl(metaTags)).toBe(seoGenerateCanonicalUrl(page, site));
  });

  it('matches canonical for root', () => {
    const page = { __metadata: { urlPath: '/' }, title: 'Home' };
    const site = { env: { URL: 'https://a.co' } };
    const metaTags = seoGenerateMetaTags(page, site);
    expect(findOgUrl(metaTags)).toBe('https://a.co/');
    expect(findOgUrl(metaTags)).toBe(seoGenerateCanonicalUrl(page, site));
  });
});

describe('formatTitle', () => {
  it('appends the artist name with an em dash and trims', () => expect(formatTitle('Silence ')).toBe('Silence \u2014 Maeve Vamy'));
  it('does not double an existing suffix', () => expect(formatTitle('Silence \u2014 Maeve Vamy')).toBe('Silence \u2014 Maeve Vamy'));
  it('does not duplicate the artist name', () => expect(formatTitle('Maeve Vamy')).toBe('Maeve Vamy'));
  it('handles empty input', () => {
    expect(formatTitle('')).toBe('Maeve Vamy');
    expect(formatTitle(undefined)).toBe('Maeve Vamy');
  });
});

describe('seoGenerateOgImage', () => {
  it('is always absolute, even with no site host', () =>
    expect(seoGenerateOgImage({ __metadata: { urlPath: '/' } }, {})).toMatch(/^https:\/\//));
});

describe('absoluteUrl', () => {
  it('prefixes relative paths', () => expect(absoluteUrl('https://a.co', '/x/')).toBe('https://a.co/x/'));
  it('adds a missing leading slash', () => expect(absoluteUrl('https://a.co', 'x/')).toBe('https://a.co/x/'));
  it('keeps absolute urls', () => expect(absoluteUrl('https://a.co', 'https://b.co/i.jpg')).toBe('https://b.co/i.jpg'));
});

describe('ogImageUrl', () => {
  it('builds an absolute Netlify image url', () =>
    expect(ogImageUrl('https://x.supabase.co/a.jpg', 'https://vamy.art')).toBe(
      'https://vamy.art/.netlify/images?url=https%3A%2F%2Fx.supabase.co%2Fa.jpg&w=1200&q=80'
    ));
});
