import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("INFRA-PW config runs mobile and desktop smoke projects without joining npm test", () => {
  const pkg = JSON.parse(read("package.json"));
  const config = read("playwright.config.ts");

  assert.equal(pkg.scripts["test:e2e"], "node scripts/run-playwright-e2e.mjs");
  assert.doesNotMatch(pkg.scripts.test, /playwright/);
  assert.equal(fs.existsSync("scripts/run-playwright-e2e.mjs"), true);
  assert.match(config, /mobile-chromium/);
  assert.match(config, /desktop-chromium/);
  assert.match(config, /viewport:\s*\{\s*width:\s*390,\s*height:\s*844\s*\}/s);
  assert.match(config, /viewport:\s*\{\s*width:\s*1280,\s*height:\s*900\s*\}/s);
  assert.match(config, /webServer/);
  assert.match(config, /scripts\/playwright-web-server\.mjs/);
  assert.equal(fs.existsSync("scripts/playwright-web-server.mjs"), true);
});

test("INFRA-PW shallow smoke spec guards public pages, console errors, mobile nav, import sheet, and Chinese copy", () => {
  const specPath = "tests/e2e/smoke.spec.ts";
  assert.equal(fs.existsSync(specPath), true, `${specPath} missing`);
  const spec = read(specPath);

  for (const route of ["/", "/watch", "/lectura", "/import", "/membership"]) {
    assert.match(spec, new RegExp(`["']${route}["']`));
  }

  assert.match(spec, /consoleMessages/);
  assert.match(spec, /page\.on\("console"/);
  assert.match(spec, /ErrorBoundary|白屏|Application error/);
  assert.match(spec, /mobile-import-trigger/);
  assert.match(spec, /EPUB\/PDF/);
  assert.match(spec, /导入电子书或文档|统一导入引擎|选择适合你的方案/);
});
