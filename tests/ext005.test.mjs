import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const readText = (path) => readFile(path, "utf8");

test("EXT-005 extension landing page exists with required sections and design tokens", async () => {
  const pagePath = "src/app/extension/page.tsx";
  assert.ok(existsSync(pagePath), `${pagePath} should exist`);

  const page = await readText(pagePath);

  assert.match(page, /SiteHeader/);
  assert.match(page, /把 YouTube 变成你的西语课堂/);
  assert.match(page, /双语字幕/);
  assert.match(page, /点词查义/);
  assert.match(page, /自动生词本/);
  assert.match(page, /安装步骤/);
  assert.match(page, /FAQ/);
  assert.match(page, /details/);
  assert.match(page, /rounded-hero/);
  assert.match(page, /rounded-card/);
  assert.match(page, /brand-600/);
});

test("EXT-005 landing page downloads the packaged extension zip", async () => {
  const page = await readText("src/app/extension/page.tsx");
  const zipPath = "public/extension/esponal-extension.zip";

  assert.match(page, /\/extension\/esponal-extension\.zip/);
  assert.match(page, /download/);
  assert.ok(existsSync(zipPath), `${zipPath} should exist`);
  assert.ok(statSync(zipPath).size > 10 * 1024, `${zipPath} should be larger than 10KB`);
});

test("EXT-005 extension package script exists and root ignores private signing keys", async () => {
  const packageScriptPath = "extension/scripts/package.mjs";
  assert.ok(existsSync(packageScriptPath), `${packageScriptPath} should exist`);

  const packageJson = await readText("extension/package.json");
  const script = await readText(packageScriptPath);
  const gitignore = await readText(".gitignore");
  const hero = await readText("src/app/components/web/HomeHero.tsx");

  assert.match(packageJson, /"package"/);
  assert.match(script, /esponal-extension\.zip/);
  assert.match(script, /"public"/);
  assert.match(script, /"extension"/);
  assert.match(gitignore, /\*\.pem/);
  assert.match(gitignore, /extension\/dist\//);
  assert.match(hero, /href="\/extension"/);
});
