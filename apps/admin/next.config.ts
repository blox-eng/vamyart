import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages expose TypeScript source — transpile through Next.js's SWC pipeline.
  transpilePackages: ["@vamy/db", "@vamy/ui"],
  // Type-checking run separately via tsc --noEmit in CI.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
