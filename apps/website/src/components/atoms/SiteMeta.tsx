import Head from 'next/head';

// Head tags every page shares. A page that must not be indexed overrides
// `robots` with its own <meta key="robots">.
export default function SiteMeta() {
    return (
        <Head>
            <meta key="robots" name="robots" content="max-image-preview:large" />
            <meta key="og:locale" property="og:locale" content="en_GB" />
            {process.env.NEXT_PUBLIC_GSC_VERIFICATION && (
                <meta key="gsc" name="google-site-verification" content={process.env.NEXT_PUBLIC_GSC_VERIFICATION} />
            )}
            {process.env.NEXT_PUBLIC_BING_VERIFICATION && (
                <meta key="bing" name="msvalidate.01" content={process.env.NEXT_PUBLIC_BING_VERIFICATION} />
            )}
        </Head>
    );
}
