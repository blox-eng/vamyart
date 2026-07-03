import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeTrailingSlash, resolveSiteUrl, seoGenerateCanonicalUrl } from './seo-utils';

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
  it('returns null when no host is available', () => expect(resolveSiteUrl({})).toBe(null));
});

describe('seoGenerateCanonicalUrl', () => {
  it('joins base + normalized urlPath', () => {
    const page = { __metadata: { urlPath: '/gallery/never' } };
    expect(seoGenerateCanonicalUrl(page, { env: { URL: 'https://a.co' } })).toBe('https://a.co/gallery/never/');
  });
  it('returns null without a host', () => {
    expect(seoGenerateCanonicalUrl({ __metadata: { urlPath: '/about' } }, {})).toBe(null);
  });
});
