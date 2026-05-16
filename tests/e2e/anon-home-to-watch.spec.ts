import { expect, test } from "@playwright/test";

test("anonymous visitor lands on hero and can open the first video card", async ({ page }) => {
  await page.goto("/");

  // Logged-out hero copy from HomeHero (WEB-009)
  await expect(page.getByText(/真实的西语视频/)).toBeVisible();

  const firstVideoCard = page.locator("[data-testid='video-card']").first();
  await expect(firstVideoCard).toBeVisible({ timeout: 15_000 });

  await Promise.all([
    page.waitForURL(/\/watch\?v=/, { timeout: 15_000 }),
    firstVideoCard.click()
  ]);

  await expect(page.locator("iframe[src*='youtube.com/embed']")).toBeVisible();
});

test("transcript panel eventually renders cues for a known video", async ({ page }) => {
  const videoId = process.env.E2E_TEST_VIDEO_ID || "dQw4w9WgXcQ";

  await page.goto(`/watch?v=${videoId}`);
  await expect(page.locator("iframe[src*='youtube.com/embed']")).toBeVisible();

  // Allow up to 20s for subtitle API + transcript hydration
  await expect(page.locator("[data-testid='transcript-cue']").first()).toBeVisible({
    timeout: 20_000
  });
});
