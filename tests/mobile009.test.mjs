import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("MOBILE-009 ticket and PM-approved design are present", async () => {
  assert.equal(existsSync("docs/tickets/MOBILE-009.md"), true);
  assert.equal(existsSync("docs/tickets/MOBILE-009-design.md"), true);

  const featureList = JSON.parse(await readText("feature_list.json"));
  const mobile009 = Object.values(featureList).find((feature) => feature.id === "MOBILE-009");
  assert.equal(mobile009?.status, "ready_for_qa");

  const design = await readText("docs/tickets/MOBILE-009-design.md");
  assert.match(design, /底部 4 tab/);
  assert.match(design, /最左:头像/);
  assert.match(design, /中间:订阅/);
  assert.match(design, /最右:搜索/);
});

test("MOBILE-009 bottom tab bar is globally mounted and route-aware", async () => {
  const layout = await readText("src/app/layout.tsx");
  const tabPath = "src/app/components/web/BottomTabBar.tsx";
  assert.equal(existsSync(tabPath), true, `${tabPath} missing`);
  const tabs = await readText(tabPath);

  assert.match(layout, /BottomTabBar/);
  assert.match(layout, /<BottomTabBar \/>/);
  assert.match(tabs, /"use client"/);
  assert.match(tabs, /usePathname/);
  assert.match(tabs, /export function shouldHideTabBar/);
  assert.match(tabs, /pathname === "\/watch"/);
  assert.match(tabs, /pathname\.startsWith\("\/watch\/"\)/);
  assert.match(tabs, /\/lectura\//);
  assert.match(tabs, /\[\^\/\]\+/);
  assert.match(tabs, /grid-cols-4/);
  assert.match(tabs, /md:hidden/);
  assert.match(tabs, /pb-safe/);
  assert.match(tabs, /min-h-\[44px\]/);
  assert.match(tabs, /text-brand-600/);
  assert.match(tabs, /href:\s*"\/watch"/);
  assert.match(tabs, /href:\s*"\/lectura"/);
  assert.match(tabs, /href:\s*"\/learn"/);
  assert.match(tabs, /href:\s*"\/vocab"/);
  assert.match(tabs, /视频/);
  assert.match(tabs, /阅读/);
  assert.match(tabs, /课程/);
  assert.match(tabs, /语料库/);
});

test("MOBILE-009 mobile top bar uses avatar, subscription, and search without touching desktop nav", async () => {
  const header = await readText("src/app/components/web/SiteHeader.tsx");
  const topBarPath = "src/app/components/web/MobileTopBar.tsx";
  assert.equal(existsSync(topBarPath), true, `${topBarPath} missing`);
  const topBar = await readText(topBarPath);
  const nav = await readText("src/app/components/web/SiteNav.tsx");

  assert.match(header, /MobileTopBar/);
  assert.match(header, /hidden md:flex/);
  assert.match(topBar, /className="md:hidden/);
  assert.match(topBar, /trigger="avatar"/);
  assert.match(topBar, /drawerSide="left"/);
  assert.match(topBar, /aria-label="管理 YouTube 订阅"/);
  assert.match(topBar, /GlobalSearchOverlay/);

  assert.match(nav, /hidden lg:flex/);
  assert.match(nav, /<MobileNav vocabHref=\{vocabHref\} session=\{session\}/);
});

test("MOBILE-009 avatar drawer keeps secondary destinations and slides from the left", async () => {
  const mobileNav = await readText("src/app/components/web/MobileNav.tsx");

  assert.match(mobileNav, /trigger\?:\s*"menu" \| "avatar"/);
  assert.match(mobileNav, /drawerSide\?:\s*"left" \| "right"/);
  assert.match(mobileNav, /trigger === "avatar"/);
  assert.match(mobileNav, /left-0/);
  assert.match(mobileNav, /-translate-x-full/);
  assert.match(mobileNav, /个人信息/);
  assert.match(mobileNav, /其他功能/);
  assert.match(mobileNav, /Esponal 积分/);
  assert.match(mobileNav, /href:\s*"\/phonics"/);
  assert.match(mobileNav, /href:\s*"\/talk"/);
  assert.match(mobileNav, /href:\s*"\/grammar"/);
  assert.match(mobileNav, /href:\s*"\/dissect"/);
});

test("MOBILE-009 fixed mobile overlays portal outside the blurred top bar", async () => {
  const mobileNav = await readText("src/app/components/web/MobileNav.tsx");
  const searchOverlay = await readText("src/app/components/web/GlobalSearchOverlay.tsx");

  assert.match(mobileNav, /createPortal/);
  assert.match(mobileNav, /document\.body/);
  assert.match(searchOverlay, /createPortal/);
  assert.match(searchOverlay, /document\.body/);
});
