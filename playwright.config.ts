import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "list" : "list",
  use: {
    baseURL: "http://127.0.0.1:3017",
    screenshot: "only-on-failure",
    trace: "retain-on-failure"
  },
  projects: [
    {
      name: "mobile-chromium",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        hasTouch: true,
        isMobile: true
      }
    },
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 }
      }
    }
  ],
  webServer: {
    command: "node scripts/playwright-web-server.mjs",
    url: "http://127.0.0.1:3017",
    timeout: 60_000,
    reuseExistingServer: false
  }
});
