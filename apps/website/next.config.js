/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
    env: {
        stackbitPreview: process.env.STACKBIT_PREVIEW
    },
    trailingSlash: true,
    reactStrictMode: true,
    allowedDevOrigins: [
        '192.168.1.84'
    ],
    // Workspace packages expose TypeScript source — transpile through Next.js's SWC pipeline.
    transpilePackages: ['@vamy/ui', '@vamy/db'],
    // Keep Node.js-only packages (postgres driver, resend, stripe) out of the client bundle.
    serverExternalPackages: ['postgres', 'resend', 'stripe'],
    // allContent() reads content/{pages,data} via a runtime glob, which Next's file
    // tracing can't statically detect — so the markdown/JSON wouldn't be bundled into
    // the serverless functions and getStaticProps would fail (undefined `site`) on any
    // on-demand / ISR render. Force-include the content dir for the pages that read it.
    outputFileTracingIncludes: {
        '**': ['./content/**/*'],
    },
    // Type-checking is run separately via `tsc --noEmit` in CI.
    typescript: {
        ignoreBuildErrors: true,
    },
    webpack(config, { isServer }) {
        if (!isServer) {
            // Mark server-only packages as externals in the browser bundle.
            // Next.js eliminates getStaticProps from the client, but webpack still tries
            // to resolve their imports. Marking them as externals prevents bundling errors.
            const serverOnlyPackages = ['postgres', 'pg', 'resend', 'stripe'];
            config.externals = [
                ...(Array.isArray(config.externals) ? config.externals : []),
                ({ request }, callback) => {
                    if (serverOnlyPackages.some((pkg) => request === pkg || request.startsWith(pkg + '/'))) {
                        return callback(null, `commonjs ${request}`);
                    }
                    callback();
                },
            ];
        }
        return config;
    },
};

module.exports = nextConfig;
