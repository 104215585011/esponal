const { chromium } = require("@playwright/test");
const path = require("path");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  // Monitor network requests/responses
  page.on("request", req => {
    if (req.url().includes("/api/vocab")) {
      console.log(`[Request] ${req.method()} ${req.url()}`);
    }
  });

  page.on("response", res => {
    if (res.url().includes("/api/vocab")) {
      console.log(`[Response] ${res.status()} ${res.url()}`);
      res.json().then(data => {
        console.log(`[Response Payload]`, JSON.stringify(data));
      }).catch(() => {});
    }
  });

  const targetDir = "C:\\Users\\wang\\.gemini\\antigravity\\brain\\7bac0d5a-3e94-46d5-9839-17e9ebbf0f49";

  console.log("Navigating to login page on port 3000...");
  await page.goto("http://127.0.0.1:3000/auth/sign-in", { waitUntil: "load", timeout: 20000 });
  await page.waitForTimeout(2000);
  
  await page.fill("input[type=email]", "e2e@esponal.test");
  await page.fill("input[type=password]", "test-e2e-password-2026");
  
  console.log("Submitting login form...");
  await Promise.all([
    page.waitForURL(url => !url.pathname.startsWith("/auth/sign-in"), { timeout: 20000 }),
    page.click("button[type=submit]")
  ]);
  console.log("Logged in successfully. Redirected to:", page.url());

  // Go to /lectura/la-siesta
  console.log("Navigating to reading page (/lectura/la-siesta)...");
  await page.goto("http://127.0.0.1:3000/lectura/la-siesta", { waitUntil: "load", timeout: 20000 });
  await page.waitForTimeout(3000);

  // Find a word (e.g. "calor" or "tarde" or "verano")
  console.log("Finding and clicking word 'calor'...");
  const wordSpan = page.locator('span[role="button"]:has-text("calor")').first();
  await wordSpan.click();
  await page.waitForTimeout(3000); // wait for LookupCard load

  const lookupCard = page.locator("[data-testid='lookup-card']");
  const button = lookupCard.locator("button").last();
  const buttonText = await button.innerText();
  console.log("Current button text:", buttonText);

  if (buttonText.includes("加入我的词库")) {
    console.log("Word not saved yet. Clicking '加入我的词库' to save it...");
    await button.click();
    await page.waitForTimeout(3000);
    console.log("Word saved. Closing LookupCard to reset state...");
    const closeBtn = lookupCard.locator("button:has-text('关闭')");
    await closeBtn.click();
    await page.waitForTimeout(1000);
    
    console.log("Waiting 6 seconds to clear the 5-second debounce window...");
    await page.waitForTimeout(6000);

    console.log("Re-clicking word 'calor' to open LookupCard again...");
    await wordSpan.click();
    await page.waitForTimeout(4000); // wait for API calls to run
  } else {
    console.log("Word is already saved.");
  }

  // Expect encounter badge to be visible
  const encounterBadge = page.locator("[data-testid='encounter-badge']");
  if (await encounterBadge.count() > 0) {
    const badgeText = await encounterBadge.innerText();
    console.log("Found encounter badge with text:", badgeText);
    await page.screenshot({ path: path.join(targetDir, "encounter_badge.png") });
    console.log("Screenshot saved: encounter_badge.png");
  } else {
    console.log("Encounter badge NOT found!");
    // Take a screenshot anyway to debug
    await page.screenshot({ path: path.join(targetDir, "encounter_badge_error.png") });
  }

  await browser.close();
  console.log("Verification finished!");
})().catch(err => {
  console.error("Error in verification:", err);
  process.exit(1);
});
