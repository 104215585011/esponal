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
  assert.ok(
    ["ready_for_qa", "passing"].includes(mobile009?.status),
    `MOBILE-009 status should be ready_for_qa or passing, got ${mobile009?.status}`
  );

  const design = await readText("docs/tickets/MOBILE-009-design.md");
  assert.match(design, /底部 4 tab|搴曢儴 4 tab/);
  assert.match(design, /头像|澶村儚/);
  assert.match(design, /订阅|璁㈤槄/);
  assert.match(design, /搜索|鎼滅储/);
});

test("MOBILE-009 bottom tab bar only appears on primary tab landing pages", async () => {
  const layout = await readText("src/app/layout.tsx");
  const tabPath = "src/app/components/web/BottomTabBar.tsx";
  assert.equal(existsSync(tabPath), true, `${tabPath} missing`);
  const tabs = await readText(tabPath);

  assert.match(layout, /BottomTabBar/);
  assert.match(layout, /<BottomTabBar \/>/);
  assert.match(tabs, /"use client"/);
  assert.match(tabs, /usePathname/);
  assert.match(tabs, /useSearchParams/);
  assert.match(tabs, /export function shouldHideTabBar/);
  assert.doesNotMatch(tabs, /pathname === "\/watch" \|\| pathname\.startsWith\("\/watch\/"\)/);
  assert.match(tabs, /searchParams\.get\("v"\)/);
  assert.match(tabs, /shouldHideTabBar\(pathname,\s*Boolean\(videoId\)\)/);
  assert.match(tabs, /pathname\.startsWith\("\/watch\/"\)/);
  assert.match(tabs, /const primaryTabLandingPaths/);
  assert.match(tabs, /primaryTabLandingPaths\.has\(pathname\)/);
  assert.match(tabs, /pathname === "\/watch"/);
  assert.match(tabs, /return !isPrimaryLandingPath/);
  assert.doesNotMatch(tabs, /if \(!pathname\.startsWith\("\/lectura\/"\)\)/);
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

test("MOBILE-009 mobile top bar is fixed while desktop header stays sticky", async () => {
  const header = await readText("src/app/components/web/SiteHeader.tsx");
  const topBarPath = "src/app/components/web/MobileTopBar.tsx";
  assert.equal(existsSync(topBarPath), true, `${topBarPath} missing`);
  const topBar = await readText(topBarPath);
  const nav = await readText("src/app/components/web/SiteNav.tsx");

  assert.match(header, /MobileTopBar/);
  assert.match(header, /md:sticky md:top-0/);
  assert.doesNotMatch(header, /<header className="sticky top-0/);
  assert.match(header, /hidden md:flex/);
  assert.match(topBar, /className="md:hidden/);
  assert.match(topBar, /fixed inset-x-0 top-0/);
  assert.match(topBar, /h-\[52px\] md:hidden/);
  assert.match(topBar, /trigger="avatar"/);
  assert.match(topBar, /drawerSide="left"/);
  assert.match(topBar, /aria-label="管理 YouTube 订阅"/);
  assert.match(topBar, /GlobalSearchOverlay/);

  assert.match(nav, /hidden lg:flex/);
  assert.match(nav, /<MobileNav vocabHref=\{vocabHref\} session=\{session\}/);
});

test("MOBILE-009 avatar drawer keeps only secondary destinations and uses correct Chinese labels", async () => {
  const mobileNav = await readText("src/app/components/web/MobileNav.tsx");
  const navItemsBlock = mobileNav.match(/const navItems:[\s\S]*?\];/)?.[0] ?? "";

  assert.match(mobileNav, /trigger\?:\s*"menu" \| "avatar"/);
  assert.match(mobileNav, /drawerSide\?:\s*"left" \| "right"/);
  assert.match(mobileNav, /trigger === "avatar"/);
  assert.match(mobileNav, /data-testid="mobile-avatar-menu-trigger"/);
  assert.match(mobileNav, /data-testid="mobile-avatar-drawer"/);
  assert.match(mobileNav, /left-0/);
  assert.match(mobileNav, /-translate-x-full/);
  assert.match(mobileNav, /个人信息/);
  assert.match(mobileNav, /次级功能/);
  assert.match(mobileNav, /设置/);
  assert.match(mobileNav, /Esponal 积分/);
  assert.match(mobileNav, /积分订阅/);
  assert.match(mobileNav, /const primaryItems/);
  assert.match(mobileNav, /const primaryLandingPaths/);
  assert.match(mobileNav, /!primaryLandingPaths\.has\(pathname\)/);
  const primaryItemsBlock = mobileNav.match(/const primaryItems:[\s\S]*?\];/)?.[0] ?? "";
  assert.match(primaryItemsBlock, /href:\s*"\/watch"/);
  assert.match(primaryItemsBlock, /href:\s*"\/lectura"/);
  assert.match(primaryItemsBlock, /href:\s*"\/learn"/);
  assert.match(primaryItemsBlock, /href:\s*"\/vocab"/);

  assert.match(navItemsBlock, /label:\s*"发音"/);
  assert.match(navItemsBlock, /href:\s*"\/phonics"/);
  assert.match(navItemsBlock, /label:\s*"对话"/);
  assert.match(navItemsBlock, /href:\s*"\/talk"/);
  assert.match(navItemsBlock, /label:\s*"语法"/);
  assert.match(navItemsBlock, /href:\s*"\/grammar"/);
  assert.match(navItemsBlock, /label:\s*"拆解"/);
  assert.match(navItemsBlock, /href:\s*"\/dissect"/);
  assert.doesNotMatch(navItemsBlock, /href:\s*"\/"/);
  assert.doesNotMatch(navItemsBlock, /href:\s*"\/watch"/);
  assert.doesNotMatch(navItemsBlock, /href:\s*"\/learn"/);
  assert.doesNotMatch(navItemsBlock, /href:\s*"\/lectura"/);
  assert.doesNotMatch(navItemsBlock, /activeHref:\s*"\/vocab"/);
  assert.doesNotMatch(navItemsBlock, /妫ｆ牠|鐎涙|鐟欏|鐠囧|闂冨|閹峰|绨/);
});

test("MOBILE-009 fixed mobile overlays portal outside the blurred top bar", async () => {
  const mobileNav = await readText("src/app/components/web/MobileNav.tsx");
  const searchOverlay = await readText("src/app/components/web/GlobalSearchOverlay.tsx");

  assert.match(mobileNav, /createPortal/);
  assert.match(mobileNav, /document\.body/);
  assert.match(searchOverlay, /createPortal/);
  assert.match(searchOverlay, /document\.body/);
});
