import { describe, expect, it } from 'vitest';
import { resolveStaticProps } from './static-props-resolvers';

describe('resolveStaticProps', () => {
  it('returns null for an address no page lives at, so the page can 404', async () => {
    const data = { pages: [{ __metadata: { urlPath: '/', modelName: 'PageLayout' } }], props: {} };
    expect(await resolveStaticProps('/nope', data)).toBeNull();
  });
});
