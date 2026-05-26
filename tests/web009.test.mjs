import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("WEB-009 tailwind config exposes unified design tokens", async () => {
  const config = await readText("tailwind.config.ts");

  assert.match(config, /brand:\s*\{/);
  assert.match(config, /500:\s*"#10b981"/);
  assert.match(config, /borderRadius:\s*\{/);
  assert.match(config, /card:\s*"12px"/);
  assert.match(config, /surface:\s*"16px"/);
  assert.match(config, /hero:\s*"24px"/);
  assert.match(config, /boxShadow:\s*\{/);
  assert.match(config, /elevated:/);
  assert.match(config, /app:\s*"#F9FAFB"/);
  assert.match(config, /darkMode:\s*"class"/);
});

test("WEB-009 does not auto-darken the public UI from OS preference", async () => {
  const globals = await readText("src/app/globals.css");

  assert.doesNotMatch(globals, /prefers-color-scheme:\s*dark/);
});

test("WEB-009 site header exposes primary navigation", async () => {
  const headerPath = "src/app/components/web/SiteHeader.tsx";
  const navPath = "src/app/components/web/SiteNav.tsx";
  const themeTogglePath = "src/app/components/web/ThemeToggle.tsx";
  assert.ok(existsSync(headerPath), `${headerPath} should exist`);
  assert.ok(existsSync(navPath), `${navPath} should exist`);
  assert.ok(existsSync(themeTogglePath), `${themeTogglePath} should exist`);

  const header = await readText(headerPath);
  const nav = await readText(navPath);
  const themeToggle = await readText(themeTogglePath);

  assert.match(header, /SiteNav/);
  assert.match(header, /ThemeToggle/);
  assert.match(nav, /href:\s*"\/"/);
  assert.match(nav, /href:\s*"\/learn"/);
  assert.match(nav, /href:\s*"\/grammar"/);
  assert.match(nav, /activeHref:\s*"\/vocab"/);
  assert.match(header, /\/auth\/sign-in\?callbackUrl=\/vocab/);
  assert.match(nav, /border-brand-500/);
  assert.match(nav, /text-brand-600/);
  assert.match(themeToggle, /localStorage\.setItem\(storageKey, nextTheme\)/);
  assert.match(themeToggle, /document\.documentElement\.classList\.toggle\("dark"/);
  assert.match(themeToggle, /prefers-color-scheme:\s*dark/);
});

test("WEB-009 homepage hero follows the current CTA contract", async () => {
  const heroPath = "src/app/components/web/HomeHero.tsx";
  const pagePath = "src/app/page.tsx";
  assert.ok(existsSync(heroPath), `${heroPath} should exist`);
  assert.ok(existsSync(pagePath), `${pagePath} should exist`);

  const hero = await readText(heroPath);
  const page = await readText(pagePath);

  assert.match(page, /getServerSession/);
  assert.match(page, /getAuthOptions/);
  assert.match(page, /<HomeHero isLoggedIn=\{!!userId\} \/>/);
  assert.match(hero, /西班牙语，从听懂开始/);
  assert.match(hero, /\/phonics/);
  assert.match(hero, /#tools/);
  assert.doesNotMatch(hero, /InstallPrompt/);
  assert.doesNotMatch(hero, /\/extension/);
  assert.match(hero, /rounded-hero/);
  assert.match(hero, /shadow-card/);
});

test("WEB-009 source no longer uses raw green or emerald utility colors", async () => {
  const files = [
    "src/app/page.tsx",
    "src/app/components/web/SiteHeader.tsx",
    "src/app/components/web/SiteNav.tsx",
    "src/app/components/web/HomeHero.tsx",
    "src/app/auth/sign-in/page.tsx",
    "src/app/auth/sign-up/page.tsx",
    "src/app/watch/TranscriptPanel.tsx",
    "src/app/watch/RelatedPanel.tsx",
    "src/app/watch/LookupCard.tsx",
    "src/app/learn/page.tsx",
    "src/app/learn/[slug]/page.tsx",
    "src/app/grammar/page.tsx",
    "src/app/grammar/[slug]/page.tsx"
  ];

  for (const file of files) {
    const source = await readText(file);
    assert.doesNotMatch(source, /green-[0-9]|emerald-[0-9]/, file);
  }
});
