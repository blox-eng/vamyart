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
    transpilePackages: ['@vamy/i18n', '@vamy/ui', '@vamy/db'],
    // Pages Router locale routing (EN/DE/BG). withNextIntl is NOT used here —
    // that plugin is App Router only and conflicts with the Pages Router i18n config.
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

module.exports = nextConfig;
