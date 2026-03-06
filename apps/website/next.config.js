const createNextIntlPlugin = require('next-intl/plugin');
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

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
    i18n: {
        locales: ['en', 'de', 'bg'],
        defaultLocale: 'en',
    },
    // Type-checking is run separately via `tsc --noEmit` in CI.
    // Workspace packages expose source TS (not compiled .d.ts), so
    // transitive deps of those packages aren't resolvable from here.
    typescript: {
        ignoreBuildErrors: true,
    },
};

module.exports = withNextIntl(nextConfig);
