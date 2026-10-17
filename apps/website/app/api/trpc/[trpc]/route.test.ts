import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('tRPC GET caching', () => {
    it('keys the CDN cache on the query input, so each piece gets its own answer', async () => {
        const res = await GET(new Request('https://vamy.art/api/trpc/no.such?input=%7B%22slug%22%3A%22silence%22%7D'));
        expect(res.headers.get('Cache-Control')).toContain('s-maxage=3600');
        expect(res.headers.get('Netlify-Vary')).toBe('query');
    });
});
