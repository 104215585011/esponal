import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  // mobile/desktop 两个 project 并行打同一个 next dev 时,编译互踩会产生
  // ERR_CONNECTION_RESET(触发冒烟的 console 断言),串行即可稳定
  workers: process.env.CI ? 2 : 1,
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
    // 本地已在跑 dev server 时直接复用,避免 Next 启动期重复编译导致 30s 超时;CI 仍强制新起
    reuseExistingServer: !process.env.CI
  }
});
