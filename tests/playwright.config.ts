import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Start dev server automatically if not already running
  webServer: {
    command: "pnpm turbo dev --filter=@vamy/website",
    url: BASE_URL,
    reuseExistingServer: true,
    cwd: "..",
    timeout: 60_000,
  },
});
