// Timestamp: 2026-05-28 09:50
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
  const videoId = "dQw4w9WgXcQ"; // Seeded YouTube video ID

  const targetDirs = [
    "C:\\Users\\wang\\esponal\\qa-artifacts\\watch-002",
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
      await themeBtn.first().click();
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

  // 1. Watch Detail page - Light Mode (Desktop)
  console.log("Navigating to Watch page...");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}/watch?v=${videoId}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(5000); // wait for player and cues to settle
  await saveScreenshot("watch_desktop_light.png");

  // 2. Watch Detail page - Dark Mode (Desktop)
  const toggled = await toggleTheme("dark");
  if (toggled) {
    await saveScreenshot("watch_desktop_dark.png");
    // Switch back to light mode
    await toggleTheme("light");
  }

  // 3. Desktop Lookup Dock - Click a word in the transcript
  console.log("Clicking word in transcript for desktop lookup dock...");
  const wordSpans = page.locator('[data-testid="transcript-cue"] span[role="button"]');
  const wordCount = await wordSpans.count();
  console.log(`Found ${wordCount} clickable transcript word spans.`);
  if (wordCount > 0) {
    const firstWord = wordSpans.first();
    console.log(`Clicking word: "${await firstWord.innerText()}"`);
    await firstWord.click();
    await page.waitForTimeout(2000); // wait for lookup lookup and dock tabs
    await saveScreenshot("watch_desktop_word_clicked.png");
  }

  // 4. Mobile View - Subtitles tab (Light Mode)
  console.log("Resizing viewport to mobile (375px)...");
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(1000);
  // Reload to clear active lookup state and render mobile default subtitles tab
  await page.goto(`${baseUrl}/watch?v=${videoId}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await saveScreenshot("watch_mobile_subtitles_light.png");

  // 5. Mobile View - Transcript tab (Light Mode)
  console.log("Switching to Mobile Transcript tab...");
  const transcriptTabBtn = page.locator('button:has-text("转写")').first();
  if (await transcriptTabBtn.count() > 0) {
    await transcriptTabBtn.click();
    await page.waitForTimeout(2000);
    await saveScreenshot("watch_mobile_transcript_light.png");

    // Click a word in the transcript panel while in mobile view
    // This should trigger the lookup and auto-focus the mobile lookup tab
    console.log("Clicking word in mobile transcript...");
    const mobileWordSpans = page.locator('[data-testid="transcript-cue"] span[role="button"]');
    if (await mobileWordSpans.count() > 0) {
      await mobileWordSpans.first().click();
      await page.waitForTimeout(2000);
      await saveScreenshot("watch_mobile_lookup_light.png");
    }
  }

  // 6. Mobile View - Related tab (Light Mode)
  console.log("Switching to Mobile Related tab...");
  const relatedTabBtn = page.locator('button:has-text("推荐")').first();
  if (await relatedTabBtn.count() > 0) {
    await relatedTabBtn.click();
    await page.waitForTimeout(1500);
    await saveScreenshot("watch_mobile_related_light.png");
  }

  console.log("Finished taking all watch screenshots successfully.");
  await browser.close();
})().catch(err => {
  console.error("Error in capture script:", err);
  process.exit(1);
});
