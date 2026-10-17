import { afterEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';

// next/head only collects tags inside a Next render; here it just renders them.
vi.mock('next/head', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
const { default: SiteMeta } = await import('./SiteMeta');

const render = () => renderToString(<SiteMeta />);

afterEach(() => vi.unstubAllEnvs());

describe('SiteMeta', () => {
    it('allows large image previews and names the locale', () => {
        const html = render();
        expect(html).toContain('<meta name="robots" content="max-image-preview:large"/>');
        expect(html).toContain('<meta property="og:locale" content="en_GB"/>');
    });
    it('adds search-engine verification only when configured', () => {
        expect(render()).not.toContain('google-site-verification');
        vi.stubEnv('NEXT_PUBLIC_GSC_VERIFICATION', 'gsc-token');
        vi.stubEnv('NEXT_PUBLIC_BING_VERIFICATION', 'bing-token');
        const html = render();
        expect(html).toContain('<meta name="google-site-verification" content="gsc-token"/>');
        expect(html).toContain('<meta name="msvalidate.01" content="bing-token"/>');
    });
});
