import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Load .env.local from repo root so DATABASE_URL is available in tests.
    envDir: "../../",
  },
});
