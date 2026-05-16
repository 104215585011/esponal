import { expect, test } from "@playwright/test";

const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL ?? "e2e@esponal.test";
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD ?? "test-e2e-password-2026";
const E2E_TEST_VIDEO_ID = process.env.E2E_TEST_VIDEO_ID ?? "dQw4w9WgXcQ";

test("logged-in user can lookup a word, save it, and find it in /vocab", async ({ page }) => {
  // Sign in via credentials form
  await page.goto("/auth/sign-in");
  await page.fill("input[type=email]", E2E_USER_EMAIL);
  await page.fill("input[type=password]", E2E_USER_PASSWORD);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/auth/sign-in"), { timeout: 15_000 }),
    page.click("button[type=submit]")
  ]);

  // Open watch page
  await page.goto(`/watch?v=${E2E_TEST_VIDEO_ID}`);

  const firstCue = page.locator("[data-testid='transcript-cue']").first();
  await expect(firstCue).toBeVisible({ timeout: 20_000 });

  // Click first clickable word inside the active cue
  const firstWord = firstCue.locator("[role='button']").first();
  await firstWord.click();

  // LookupCard should appear
  const lookupCard = page.locator("[data-testid='lookup-card']");
  await expect(lookupCard).toBeVisible({ timeout: 20_000 });

  // Click "加入我的词库"
  await lookupCard.getByRole("button", { name: /加入我的词库/ }).click();
  await expect(lookupCard.getByText(/已加入词库/)).toBeVisible({ timeout: 15_000 });

  // Verify in /vocab
  await page.goto("/vocab");
  await expect(page.locator("[data-testid='vocab-word']").first()).toBeVisible({
    timeout: 10_000
  });
});
