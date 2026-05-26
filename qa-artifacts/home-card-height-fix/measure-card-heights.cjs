const { chromium } = require("@playwright/test");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto(process.env.HOME_URL || "http://127.0.0.1:3004/", { waitUntil: "networkidle", timeout: 30000 });
  await page.locator('[data-testid="learning-step-card"]').first().scrollIntoViewIfNeeded();
  const result = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('[data-testid="learning-step-card"]')];
    const links = [...document.querySelectorAll('[data-testid="learning-step-card"] a')];

    return {
      count: cards.length,
      heights: cards.map((el) => Math.round(el.getBoundingClientRect().height)),
      ctaTops: links.map((el) => Math.round(el.getBoundingClientRect().top)),
      uniqueHeights: [...new Set(cards.map((el) => Math.round(el.getBoundingClientRect().height)))]
    };
  });

  await page.screenshot({ path: "qa-artifacts/home-card-height-fix/home-learning-path-1600.png", fullPage: false });
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
