import { expect, test, type Page } from "@playwright/test";

const publicRoutes = [
  "/",
  "/home",
  "/watch",
  "/lectura",
  "/review",
  "/me",
  "/import",
  "/membership"
] as const;
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

/* ------------------------------------------------------------------
   MOBILE-R2:持久壳契约
   ------------------------------------------------------------------ */

const isMobileProject = (name: string) => name.includes("mobile");
const SHELL = "[data-testid='mobile-app-shell']";
const TABBAR = "[data-testid='mobile-shell-tabbar']";

const SHELL_TABS = [
  { href: "/home", label: "首页" },
  { href: "/watch", label: "视频" },
  { href: "/lectura", label: "阅读" },
  { href: "/review", label: "复习" },
  { href: "/me", label: "我的" }
] as const;

test("mobile shell renders all five tabs on every tab page", async ({ page }, testInfo) => {
  test.skip(!isMobileProject(testInfo.project.name), "mobile-only shell contract");

  for (const tab of SHELL_TABS) {
    const response = await page.goto(tab.href, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `${tab.href} should return 200`).toBe(200);
    await expect(page.locator(TABBAR)).toBeVisible();
    await expect(page.locator(TABBAR).getByRole("link", { name: tab.label })).toBeVisible();
  }
});

test("tab bar DOM survives tab switches without remounting", async ({ page }, testInfo) => {
  test.skip(!isMobileProject(testInfo.project.name), "mobile-only shell contract");

  await page.goto("/home", { waitUntil: "domcontentloaded" });
  const tabbar = page.locator(TABBAR);
  await expect(tabbar).toBeVisible();

  // 在 DOM 节点上打标记:客户端路由切换若重建了底栏,标记会消失
  await page.evaluate((selector) => {
    const node = document.querySelector(selector) as (HTMLElement & { __shellMark?: string }) | null;
    if (node) node.__shellMark = "alive";
  }, TABBAR);

  await tabbar.getByRole("link", { name: "视频" }).click();
  await page.waitForURL("**/watch", { timeout: 15_000 });
  await expect(page.locator(TABBAR)).toBeVisible();

  const mark = await page.evaluate((selector) => {
    const node = document.querySelector(selector) as (HTMLElement & { __shellMark?: string }) | null;
    return node?.__shellMark ?? null;
  }, TABBAR);

  expect(mark, "tab bar must not be remounted on tab switch").toBe("alive");
});

test("desktop never mounts the mobile shell", async ({ page }, testInfo) => {
  test.skip(isMobileProject(testInfo.project.name), "desktop-only shell contract");

  for (const route of ["/", "/watch", "/home"]) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator(SHELL)).toHaveCount(0);
    await expect(page.locator(TABBAR)).toHaveCount(0);
  }
});

test("push pages show a back affordance and hide the tab bar", async ({ page }, testInfo) => {
  test.skip(!isMobileProject(testInfo.project.name), "mobile-only shell contract");

  await page.goto("/membership", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "返回" })).toBeVisible();
  await expect(page.locator(TABBAR)).toHaveCount(0);
});
