import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");


test("MOBILE-009 → MOBILE-R2: bottom tabs come from the single persistent shell, not a per-page bar", async () => {
  const layout = await readText("src/app/layout.tsx");
  const shellPath = "src/app/components/shell/AppShell.tsx";
  assert.equal(existsSync(shellPath), true, `${shellPath} missing`);

  // 旧底栏已下线:文件删除 + 根 layout 不再引用
  assert.equal(
    existsSync("src/app/components/web/BottomTabBar.tsx"),
    false,
    "legacy BottomTabBar must be deleted (MOBILE-R2)"
  );
  assert.match(layout, /<AppShell \/>/);
  assert.doesNotMatch(layout, /BottomTabBar/);

  const shell = await readText(shellPath);
  assert.match(shell, /"use client"/);
  assert.match(shell, /usePathname/);
  assert.match(shell, /useSearchParams/);
  assert.match(shell, /searchParams\.get\("v"\)/);
  assert.match(shell, /isImmersivePath/);
});

test("MOBILE-009 → MOBILE-R2: mobile chrome lives in the persistent shell; desktop header stays sticky", async () => {
  const header = await readText("src/app/components/web/SiteHeader.tsx");
  const shell = await readText("src/app/components/shell/AppShell.tsx");

  // 旧移动顶栏已下线,页面不再各挂一份
  assert.equal(existsSync("src/app/components/web/MobileTopBar.tsx"), false, "legacy MobileTopBar must be deleted");
  assert.doesNotMatch(header, /MobileTopBar/);
  assert.match(header, /md:sticky md:top-0/);

  // 新壳:固定顶栏 + 52px 高 + 毛玻璃
  assert.match(shell, /fixed inset-x-0 top-0/);
  assert.match(shell, /h-\[52px\]/);
  assert.match(shell, /backdrop-blur-\[16px\]/);
  assert.match(shell, /md:hidden/);
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
});

test("MOBILE-009 fixed mobile overlays portal outside the blurred top bar", async () => {
  const mobileNav = await readText("src/app/components/web/MobileNav.tsx");
  const searchOverlay = await readText("src/app/components/web/GlobalSearchOverlay.tsx");

  assert.match(mobileNav, /createPortal/);
  assert.match(mobileNav, /document\.body/);
  assert.match(searchOverlay, /createPortal/);
  assert.match(searchOverlay, /document\.body/);
});

test("MOBILE-R2 shell tab bar keeps the lighter mockup treatment after the rewrite", async () => {
  const shell = await readText("src/app/components/shell/AppShell.tsx");

  assert.match(shell, /bg-white\/92/);
  assert.match(shell, /backdrop-blur-\[18px\]/);
  assert.match(shell, /pb-\[calc\(8px\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(shell, /h-\[21px\] w-\[21px\]/);
  assert.match(shell, /text-\[10\.5px\]/);
  assert.match(shell, /text-brand-700/);
  assert.doesNotMatch(shell, /shadow-\[0_-1px_12px_rgba\(0,0,0,0\.04\)\]/);
});
