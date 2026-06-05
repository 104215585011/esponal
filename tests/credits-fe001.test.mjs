import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const readText = (filePath) => readFile(filePath, "utf8");

test("CREDITS-FE-001 exposes an authenticated credits summary API", async () => {
  const routePath = "src/app/api/credits/route.ts";
  assert.equal(existsSync(routePath), true, `${routePath} missing`);

  const source = await readText(routePath);
  assert.match(source, /getServerSession/);
  assert.match(source, /getAuthOptions/);
  assert.match(source, /getCreditSummary/);
  assert.match(source, /return NextResponse\.json\(\s*\{\s*error:\s*"Unauthorized"\s*\},\s*\{\s*status:\s*401\s*\}\s*\)/);
  assert.match(source, /plan:\s*summary\.plan/);
  assert.match(source, /balanceDisplay:\s*summary\.balanceDisplay/);
  assert.match(source, /balanceMinor:\s*summary\.balanceMinor/);
});

test("CREDITS-FE-001 adds a flagship membership route with balance-aware pricing tabs", async () => {
  const pagePath = "src/app/membership/page.tsx";
  const tabsPath = "src/app/membership/MembershipTabs.tsx";
  assert.equal(existsSync(pagePath), true, `${pagePath} missing`);
  assert.equal(existsSync(tabsPath), true, `${tabsPath} missing`);

  const pageSource = await readText(pagePath);
  const tabsSource = await readText(tabsPath);

  assert.match(pageSource, /SiteHeader/);
  assert.match(pageSource, /getCreditSummary/);
  assert.match(pageSource, /选择适合你的方案/);
  assert.match(pageSource, /配额只用于 AI 加工/);
  assert.match(pageSource, /currentPlan/);
  assert.match(pageSource, /balanceDisplay/);

  assert.match(tabsSource, /"use client"/);
  assert.match(tabsSource, /type BillingCycle = "monthly" \| "yearly" \| "founder"/);
  assert.match(tabsSource, /useState<BillingCycle>\("monthly"\)/);
  assert.match(tabsSource, /月付/);
  assert.match(tabsSource, /年付/);
  assert.match(tabsSource, /共建者/);
  assert.match(tabsSource, /当前方案/);
  assert.match(tabsSource, /即将开放/);
  assert.match(tabsSource, /限量 500/);
  assert.match(tabsSource, /推荐/);
});

test("CREDITS-FE-001 surfaces balance and membership entry in the shared header and mobile drawer", async () => {
  const headerSource = await readText("src/app/components/web/SiteHeader.tsx");
  const navSource = await readText("src/app/components/web/MobileNav.tsx");

  assert.match(headerSource, /getCreditSummary/);
  assert.match(headerSource, /href="\/membership"/);
  assert.match(headerSource, /配额/);
  assert.match(headerSource, /balanceDisplay/);

  assert.match(navSource, /creditSummary\?:/);
  assert.match(navSource, /href="\/membership"/);
  assert.match(navSource, /当前配额/);
  assert.match(navSource, /balanceDisplay/);
});
