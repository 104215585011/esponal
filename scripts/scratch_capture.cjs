const { chromium } = require("@playwright/test");
const path = require("path");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Set window size for desktop
  await page.setViewportSize({ width: 1440, height: 900 });

  const targetDir = "C:\\Users\\wang\\.gemini\\antigravity\\brain\\7bac0d5a-3e94-46d5-9839-17e9ebbf0f49";

  console.log("Navigating to homepage on port 3004...");
  await page.goto("http://127.0.0.1:3004/", { waitUntil: "load", timeout: 30000 });
  
  console.log("Waiting 10 seconds for Next.js to compile styles and pages...");
  await page.waitForTimeout(10000);
  
  // Capture Light Mode Homepage
  console.log("Taking screenshot of Homepage Light Mode...");
  await page.screenshot({ path: path.join(targetDir, "homepage_light.png") });

  // Click theme toggle to switch to Dark Mode
  console.log("Locating theme toggle button...");
  const themeToggle = page.locator('button[aria-label*="主题"], button[aria-label*="theme"], button[id*="theme-toggle"], [data-testid="theme-toggle"]');
  if (await themeToggle.count() > 0) {
    console.log("Clicking theme toggle...");
    await themeToggle.first().click();
    await page.waitForTimeout(2000); // wait for transitions
    console.log("Taking screenshot of Homepage Dark Mode...");
    await page.screenshot({ path: path.join(targetDir, "homepage_dark.png") });
    // Switch back to light mode for remaining screenshots
    await themeToggle.first().click();
    await page.waitForTimeout(1000);
  } else {
    console.log("Direct theme toggle button not found. Trying any button in header...");
    const headerButtons = page.locator('header button');
    const btnCount = await headerButtons.count();
    if (btnCount > 0) {
      await headerButtons.last().click();
      await page.waitForTimeout(2000);
      console.log("Taking screenshot of Homepage Dark Mode (fallback)...");
      await page.screenshot({ path: path.join(targetDir, "homepage_dark.png") });
      // Switch back
      await headerButtons.last().click();
      await page.waitForTimeout(1000);
    }
  }

  // Mobile View
  console.log("Resizing viewport to mobile width (375px)...");
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(targetDir, "homepage_mobile_closed.png") });

  // Open mobile menu
  console.log("Locating hamburger button...");
  const hamburger = page.locator('button[aria-label*="菜单"], button[aria-label*="menu"], header button').first();
  if (await hamburger.count() > 0) {
    await hamburger.click();
    await page.waitForTimeout(1000);
    console.log("Taking screenshot of Mobile Menu Open...");
    await page.screenshot({ path: path.join(targetDir, "homepage_mobile_open.png") });
  }

  // Restore Desktop size for next navigations
  await page.setViewportSize({ width: 1440, height: 900 });

  // Go to /watch
  console.log("Navigating to /watch...");
  try {
    await page.goto("http://127.0.0.1:3004/watch", { waitUntil: "load", timeout: 25000 });
    console.log("Waiting 6 seconds for watch page to compile...");
    await page.waitForTimeout(6000);
    await page.screenshot({ path: path.join(targetDir, "watch_page.png") });
  } catch (e) {
    console.log("Watch page timed out or failed, skipping watch_page screenshot...");
  }

  // Go to /lectura
  console.log("Navigating to /lectura list...");
  try {
    await page.goto("http://127.0.0.1:3004/lectura", { waitUntil: "load", timeout: 25000 });
    console.log("Waiting 6 seconds for lectura list to compile...");
    await page.waitForTimeout(6000);
    await page.screenshot({ path: path.join(targetDir, "lectura_list.png") });
  } catch (e) {
    console.log("Lectura list timed out or failed, skipping lectura_list screenshot...");
  }

  // Go to /lectura/la-siesta
  console.log("Navigating to reading detail page (/lectura/la-siesta)...");
  try {
    await page.goto("http://127.0.0.1:3004/lectura/la-siesta", { waitUntil: "load", timeout: 25000 });
    console.log("Waiting 6 seconds for lectura detail page to compile...");
    await page.waitForTimeout(6000);
    await page.screenshot({ path: path.join(targetDir, "lectura_detail.png") });
  } catch (e) {
    console.log("Lectura detail page timed out or failed, skipping lectura_detail screenshot...");
  }

  console.log("Visual verification capture completed successfully!");
  await browser.close();
})().catch(err => {
  console.error("Error in capture script:", err);
  process.exit(1);
});
