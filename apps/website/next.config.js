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
    // Type-checking is run separately via `tsc --noEmit` in CI.
    typescript: {
        ignoreBuildErrors: true,
    },
};

module.exports = nextConfig;
