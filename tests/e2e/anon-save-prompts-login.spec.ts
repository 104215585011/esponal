import { expect, test } from "@playwright/test";

const E2E_TEST_VIDEO_ID = process.env.E2E_TEST_VIDEO_ID ?? "dQw4w9WgXcQ";

test("anonymous click on 加入词库 surfaces an inline sign-in CTA with callbackUrl", async ({
  page
}) => {
  await page.goto(`/watch?v=${E2E_TEST_VIDEO_ID}`);

  const firstCue = page.locator("[data-testid='transcript-cue']").first();
  await expect(firstCue).toBeVisible({ timeout: 20_000 });
  await firstCue.locator("[role='button']").first().click();

  const lookupCard = page.locator("[data-testid='lookup-card']");
  await expect(lookupCard).toBeVisible({ timeout: 20_000 });

  // Trigger save → 401 → login prompt
  await lookupCard.getByRole("button", { name: /加入我的词库/ }).click();

  const signInLink = lookupCard.getByRole("link", { name: /登录.*注册/ });
  await expect(signInLink).toBeVisible({ timeout: 10_000 });
  await expect(signInLink).toHaveAttribute("href", /\/auth\/sign-in\?callbackUrl=/);
});
