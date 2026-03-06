import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["api/**/*.test.ts"],
    // Requires a running dev server at TEST_BASE_URL (default: http://localhost:3000)
    testTimeout: 15000,
  },
});
