const { chromium } = require("@playwright/test");
const path = require("path");
const fs = require("fs");

(async () => {
  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const appPort = "3000";
  const baseUrl = `http://127.0.0.1:${appPort}`;
  const targetDirs = [
    "C:\\Users\\wang\\esponal\\qa-artifacts\\lectura-002",
    "C:\\Users\\wang\\.gemini\\antigravity\\brain\\7bac0d5a-3e94-46d5-9839-17e9ebbf0f49"
  ];

  for (const dir of targetDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const saveScreenshot = async (filename) => {
    for (const dir of targetDirs) {
      const destPath = path.join(dir, filename);
      await page.screenshot({ path: destPath });
      console.log(`Saved screenshot: ${destPath}`);
    }
  };

  // Helper to toggle theme
  const toggleTheme = async (label) => {
    console.log(`Attempting to toggle theme to ${label}...`);
    const themeBtn = page.locator('button[aria-label*="夜间"], button[aria-label*="日间"], button[aria-label*="模式"], button[aria-label*="主题"]');
    const cnt = await themeBtn.count();
    console.log(`Found ${cnt} potential theme buttons.`);
    if (cnt > 0) {
      const btn = themeBtn.first();
      console.log(`Clicking theme button with aria-label: ${await btn.getAttribute("aria-label")}`);
      await btn.click();
      await page.waitForTimeout(1500);
      return true;
    }
    return false;
  };

  // Sign in first
  console.log("Navigating to sign-in page...");
  await page.goto(`${baseUrl}/auth/sign-in`, { waitUntil: "networkidle" });
  await page.fill("input[type=email]", "e2e@esponal.test");
  await page.fill("input[type=password]", "test-e2e-password-2026");
  console.log("Submitting login form...");
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes("/auth/sign-in")),
    page.click("button[type=submit]")
  ]);
  console.log("Signed in successfully.");

  // 1. Reading List page - Light Mode (Desktop)
  console.log("Navigating to Reading List page...");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}/lectura`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await saveScreenshot("lectura_list_light_desktop.png");

  // 2. Reading List page - Dark Mode (Desktop)
  const toggled = await toggleTheme("dark");
  if (toggled) {
    await saveScreenshot("lectura_list_dark_desktop.png");
    // Switch back to light mode
    await toggleTheme("light");
  }

  // 3. Reading Detail page - la-siesta (Desktop, Mode B: Dock, Light Mode)
  console.log("Navigating to detail page: la-siesta...");
  await page.goto(`${baseUrl}/baseUrl/lectura/la-siesta`.replace("/baseUrl", ""), { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await saveScreenshot("lectura_detail_lasiesta_light_desktop.png");

  // Switch to dark mode on detail page
  const toggledDetail = await toggleTheme("dark");
  if (toggledDetail) {
    await saveScreenshot("lectura_detail_lasiesta_dark_desktop.png");
    // Switch back to light
    await toggleTheme("light");
  }

  // 4. Click a word to test Mode B: Dock
  console.log("Clicking word in dock mode...");
  const wordSpans = page.locator('span[role="button"]');
  const wordCount = await wordSpans.count();
  console.log(`Found ${wordCount} word spans.`);
  if (wordCount > 0) {
    const firstWord = wordSpans.first();
    console.log(`Clicking word: "${await firstWord.innerText()}"`);
    await firstWord.click();
    await page.waitForTimeout(1500);
    await saveScreenshot("lectura_detail_lasiesta_word_clicked_dock.png");
  }

  // 5. Open settings, switch to Mode A: Float card
  console.log("Opening reading preferences popover...");
  const settingsBtn = page.locator('button[aria-label="阅读设置"]').first();
  if (await settingsBtn.count() > 0) {
    await settingsBtn.click();
    await page.waitForTimeout(1000);
    
    console.log("Switching lookup mode to 'float'...");
    const floatBtn = page.locator('button:has-text("浮动气泡")').first();
    if (await floatBtn.count() > 0) {
      await floatBtn.click();
      await page.waitForTimeout(1000);
    }
    // Close preferences panel by clicking header
    await page.click("h1");
    await page.waitForTimeout(500);

    // Click word again to show float card
    console.log("Clicking word in float card mode...");
    const wordSpansFloat = page.locator('span[role="button"]');
    if (await wordSpansFloat.count() > 0) {
      await wordSpansFloat.first().click();
      await page.waitForTimeout(1500);
      await saveScreenshot("lectura_detail_lasiesta_word_clicked_float.png");
    }
  }

  // 6. Mobile View (la-siesta, Float card, Light Mode)
  console.log("Resizing viewport to mobile (375px)...");
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(1000);
  // Reload to ensure mobile auto-detect of float mode kicks in
  await page.goto(`${baseUrl}/lectura/la-siesta`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await saveScreenshot("lectura_detail_lasiesta_mobile_light.png");

  // Switch mobile to dark mode
  const toggledMobile = await toggleTheme("dark");
  if (toggledMobile) {
    await saveScreenshot("lectura_detail_lasiesta_mobile_dark.png");
  }

  console.log("Finished taking all screenshots successfully.");
  await browser.close();
})().catch(err => {
  console.error("Error in capture script:", err);
  process.exit(1);
});
