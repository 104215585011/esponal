import { expect, test, type Page } from "@playwright/test";

const publicRoutes = ["/", "/watch", "/lectura", "/import", "/membership"] as const;
const blockedConsolePatterns = [
  /Application error/i,
  /ErrorBoundary/i,
  /白屏/,
  /Unhandled Runtime Error/i,
];
const ignoredConsolePatterns = [
  /apple-mobile-web-app-capable/i,
  /LanguageDetector/i,
  /Images loaded lazily/i,
  /Sentry/i,
  /favicon/i,
];

function attachConsoleGuard(page: Page) {
  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (ignoredConsolePatterns.some((pattern) => pattern.test(text))) return;
    consoleMessages.push(text);
  });

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  return { consoleMessages, pageErrors };
}

test("public pages render without white screens or console errors", async ({ page }) => {
  const { consoleMessages, pageErrors } = attachConsoleGuard(page);

  for (const route of publicRoutes) {
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `${route} should return 200`).toBe(200);
    await expect(page.locator("body")).not.toBeEmpty();
    await expect(page.locator("body")).not.toContainText(/Application error|ErrorBoundary|白屏/);
  }

  expect(
    consoleMessages.filter((message) => blockedConsolePatterns.some((pattern) => pattern.test(message)))
  ).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("mobile import sheet opens and closes from the shared bottom navigation", async ({
  page
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "mobile-only shell smoke");

  const { consoleMessages, pageErrors } = attachConsoleGuard(page);
  await page.goto("/watch", { waitUntil: "domcontentloaded" });

  const trigger = page.locator("[data-testid='mobile-import-trigger']");
  await expect(trigger).toBeVisible();
  await trigger.click();
  await page.getByRole("button", { name: "EPUB/PDF" }).click();
  await expect(page.getByText(/导入电子书或文档|EPUB\/PDF/)).toBeVisible();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(page.getByText(/导入电子书或文档/)).toBeHidden();

  expect(consoleMessages).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("key Chinese copy renders without mojibake", async ({ page }) => {
  const { consoleMessages, pageErrors } = attachConsoleGuard(page);

  await page.goto("/import", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("统一导入引擎")).toBeVisible();
  await expect(page.getByText("点击选择文件")).toBeVisible();

  await page.goto("/membership", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("选择适合你的方案")).toBeVisible();

  expect(consoleMessages).toEqual([]);
  expect(pageErrors).toEqual([]);
});
