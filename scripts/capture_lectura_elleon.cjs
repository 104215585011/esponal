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
    if (cnt > 0) {
      const btn = themeBtn.first();
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

  // Go to /lectura/el-leon-y-el-raton
  console.log("Navigating to detail page: el-leon-y-el-raton...");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}/lectura/el-leon-y-el-raton`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await saveScreenshot("lectura_detail_elleon_light_desktop.png");

  // Switch to dark mode
  const toggled = await toggleTheme("dark");
  if (toggled) {
    await saveScreenshot("lectura_detail_elleon_dark_desktop.png");
    await toggleTheme("light");
  }

  console.log("Finished taking additional screenshots successfully.");
  await browser.close();
})().catch(err => {
  console.error("Error in capture script:", err);
  process.exit(1);
});
