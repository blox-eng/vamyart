import { defineConfig } from "vitest/config";

export default defineConfig({
  // Next compiles JSX with the automatic runtime; match it so components
  // without `import React` render in tests.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
  },
});
