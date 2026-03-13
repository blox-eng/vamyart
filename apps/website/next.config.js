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
