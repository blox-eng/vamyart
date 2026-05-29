import * as React from 'react';
import Script from 'next/script';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { trpc } from '../lib/trpc';
import { AnnouncementBanner } from '../components/AnnouncementBanner';
import '../css/main.css';

function getBaseUrl() {
    if (typeof window !== 'undefined') return '';
    return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
}

function AppInner({ Component, pageProps }) {
    const slug = typeof window !== 'undefined' ? window.location.pathname.replace(/^\/|\/$/g, '') || 'home' : 'home';
    const { data: banner } = trpc.banners.getActive.useQuery({ slug }, { staleTime: 60_000 });
    return (
        <>
            <AnnouncementBanner banner={banner ?? null} />
            <Component {...pageProps} />
        </>
    );
}

export default function MyApp({ Component, pageProps }) {
    const [queryClient] = React.useState(() => new QueryClient());
    const [trpcClient] = React.useState(() =>
        trpc.createClient({
            links: [
                httpBatchLink({
                    url: `${getBaseUrl()}/api/trpc`,
                }),
            ],
        })
    );

    return (
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>
                <AppInner Component={Component} pageProps={pageProps} />
                {process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID && (
                    <Script
                        defer
                        src={`${process.env.NEXT_PUBLIC_UMAMI_HOST || 'https://cloud.umami.is'}/script.js`}
                        data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
                        strategy="afterInteractive"
                    />
                )}
            </QueryClientProvider>
        </trpc.Provider>
    );
}
