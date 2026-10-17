import { describe, expect, it } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { trpc } from '../../../lib/trpc';
import { ProductSelector } from '.';

const print = {
    id: 'a4', name: 'A4 — 21 × 30 cm', price: '1200', isOriginal: false, soldAt: null,
    stockQuantity: 3, available: true, attributes: {},
};
const products = [{ id: 'p', name: 'Never', active: true, variants: [print], shippingMethod: null }];

// Server render only: whatever shows here is in the HTML crawlers get.
function serverRender(queryClient = new QueryClient()) {
    const client = trpc.createClient({ links: [httpBatchLink({ url: 'http://localhost/never-called' })] });
    return renderToString(
        <trpc.Provider client={client} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>
                <ProductSelector artworkSlug="never" initialProducts={products as never} />
            </QueryClientProvider>
        </trpc.Provider>,
    );
}

describe('ProductSelector on the server', () => {
    it('treats the page\'s products as old, so the browser checks live stock on load', () => {
        const queryClient = new QueryClient();
        serverRender(queryClient);
        const [query] = queryClient.getQueryCache().getAll();
        expect(query.state.dataUpdatedAt).toBe(0);
    });
    it('renders prices into the first HTML, without a loading skeleton', () => {
        const html = serverRender();
        expect(html).toContain('1,200');
        expect(html).not.toContain('aria-busy');
    });
    it('calls the price final instead of talking about VAT', () => {
        const html = serverRender();
        expect(html).toContain('Final price · shipping at checkout.');
        expect(html).not.toContain('VAT');
    });
});
