import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

test("MOBILE-R-001 route table is the single source for tabs, pushes, sheets, and parent tabs", async () => {
  const routePath = "src/app/components/shell/routes.ts";
  assert.equal(existsSync(routePath), true, `${routePath} missing`);
  const routes = await readText(routePath);

  for (const path of ["/home", "/watch", "/lectura", "/review", "/me"]) {
    const literalPath = escapeRegExp(path);
    assert.match(routes, new RegExp(`path:\\s*"${literalPath}"`));
    assert.match(routes, new RegExp(`path:\\s*"${literalPath}"[\\s\\S]*?level:\\s*"tab"`));
  }

  for (const [path, parentTab] of [
    ["/watch", "/watch"],
    ["/import/[id]", "/lectura"],
    ["/lectura/[slug]", "/lectura"],
    ["/account/credits", "/me"],
    ["/membership", "/me"],
    ["/settings", "/me"],
  ]) {
    assert.match(routes, new RegExp(`path:\\s*"${escapeRegExp(path)}"[\\s\\S]*?parentTab:\\s*"${escapeRegExp(parentTab)}"`));
  }

  assert.match(routes, /getShellRouteForPath/);
  assert.match(routes, /getParentTabForPath/);
});

test("MOBILE-R-001 app shell provides mobile-only chrome, five tabs, import action, and scroll memory", async () => {
  const shellPath = "src/app/components/shell/AppShell.tsx";
  assert.equal(existsSync(shellPath), true, `${shellPath} missing`);
  const shell = await readText(shellPath);

  assert.match(shell, /md:hidden/);
  assert.match(shell, /data-testid="mobile-app-shell"/);
  assert.match(shell, /data-testid="mobile-shell-tabbar"/);
  assert.match(shell, /shellTabRoutes\.map/);
  assert.match(shell, /ImportSheet/);
  assert.match(shell, /aria-label="导入"/);
  assert.match(shell, /sessionStorage/);
  assert.match(shell, /requestAnimationFrame/);
  assert.match(shell, /transition-opacity duration-\[150ms\]/);
  assert.doesNotMatch(shell, /SiteHeader/);
});

test("MOBILE-R-001 back hook encapsulates the four approved back rules", async () => {
  const hookPath = "src/app/components/shell/useShellBack.ts";
  assert.equal(existsSync(hookPath), true, `${hookPath} missing`);
  const hook = await readText(hookPath);

  assert.match(hook, /useShellBack/);
  assert.match(hook, /router\.back\(\)/);
  assert.match(hook, /getParentTabForPath/);
  assert.match(hook, /router\.replace\(fallbackTab\)/);
  assert.match(hook, /window\.history\.length/);
  assert.match(hook, /closeSheet/);
});

test("MOBILE-R-001 placeholder tab pages mount the shell without migrating business pages", async () => {
  for (const path of ["src/app/home/page.tsx", "src/app/review/page.tsx", "src/app/me/page.tsx"]) {
    assert.equal(existsSync(path), true, `${path} missing`);
    const page = await readText(path);
    assert.match(page, /AppShell/);
    assert.match(page, /建设中/);
  }

  const layout = await readText("src/app/layout.tsx");
  assert.match(layout, /<BottomTabBar \/>/);
  assert.doesNotMatch(layout, /<AppShell/);
});
