const { chromium } = require("@playwright/test");
const path = require("path");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  const targetDir = "C:\\Users\\wang\\.gemini\\antigravity\\brain\\7bac0d5a-3e94-46d5-9839-17e9ebbf0f49";

  console.log("Navigating to lectura detail page...");
  await page.goto("http://127.0.0.1:3004/lectura/la-siesta", { waitUntil: "load", timeout: 25000 });
  await page.waitForTimeout(5000);

  console.log("Clicking theme toggle to switch to Dark Mode...");
  const themeToggle = page.locator('button[aria-label*="主题"], button[aria-label*="theme"], button[id*="theme-toggle"], [data-testid="theme-toggle"]');
  if (await themeToggle.count() > 0) {
    await themeToggle.first().click();
    await page.waitForTimeout(2000);
    console.log("Taking screenshot of detail page in Dark Mode...");
    await page.screenshot({ path: path.join(targetDir, "lectura_detail_dark.png") });
  } else {
    const headerButtons = page.locator('header button');
    const btnCount = await headerButtons.count();
    if (btnCount > 0) {
      await headerButtons.last().click();
      await page.waitForTimeout(2000);
      console.log("Taking screenshot of detail page in Dark Mode (fallback)...");
      await page.screenshot({ path: path.join(targetDir, "lectura_detail_dark.png") });
    }
  }

  console.log("Dark detail capture completed!");
  await browser.close();
})().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
