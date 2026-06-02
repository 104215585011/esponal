import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("PWA-001 manifest exists and exposes install metadata", async () => {
  const path = "public/manifest.webmanifest";
  assert.equal(existsSync(path), true, `${path} missing`);

  const manifest = JSON.parse(await readText(path));
  assert.equal(manifest.short_name, "Esponal");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.theme_color, "#10b981");
  assert.equal(manifest.background_color, "#F9FAFB");
  assert.equal(Array.isArray(manifest.icons), true);
  assert.equal(manifest.icons.length, 4);
});

test("PWA-001 icon assets exist and are non-trivial PNGs", async () => {
  const iconPaths = [
    "public/icons/icon-192.png",
    "public/icons/icon-512.png",
    "public/icons/icon-maskable-192.png",
    "public/icons/icon-maskable-512.png"
  ];

  for (const path of iconPaths) {
    assert.equal(existsSync(path), true, `${path} missing`);
    const info = await stat(path);
    assert.ok(info.size > 1024, `${path} should be larger than 1KB`);
  }
});

test("PWA-001 exposes a default favicon for browser /favicon.ico requests", async () => {
  const faviconPath = "public/favicon.ico";
  const layoutPath = "src/app/layout.tsx";

  assert.equal(existsSync(faviconPath), true, `${faviconPath} missing`);
  const info = await stat(faviconPath);
  assert.ok(info.size > 1024, `${faviconPath} should be larger than 1KB`);

  const layout = await readText(layoutPath);
  assert.match(layout, /icon:\s*"\/favicon\.ico"/);
});

test("PWA-001 service worker wiring exists", async () => {
  const swPath = "src/sw.ts";
  const publicSwPath = "public/sw.js";
  const registerPath = "src/app/components/web/ServiceWorkerRegister.tsx";
  assert.equal(existsSync(swPath), true, `${swPath} missing`);
  assert.equal(existsSync(publicSwPath), true, `${publicSwPath} missing`);
  assert.equal(existsSync(registerPath), true, `${registerPath} missing`);

  const sw = await readText(swPath);
  const publicSw = await readText(publicSwPath);
  const register = await readText(registerPath);

  assert.match(sw, /addEventListener\("fetch"/);
  assert.match(sw, /caches\.open/);
  assert.match(publicSw, /offline/);
  assert.match(register, /navigator\.serviceWorker\.register\("\/sw\.js"\)/);
});

test("PWA-001 layout exposes manifest and service worker hooks while install prompt stays reusable", async () => {
  const layoutPath = "src/app/layout.tsx";
  const heroPath = "src/app/components/web/HomeHero.tsx";
  const promptPath = "src/app/components/web/InstallPrompt.tsx";
  assert.equal(existsSync(layoutPath), true, `${layoutPath} missing`);
  assert.equal(existsSync(heroPath), true, `${heroPath} missing`);
  assert.equal(existsSync(promptPath), true, `${promptPath} missing`);

  const layout = await readText(layoutPath);
  const hero = await readText(heroPath);
  const prompt = await readText(promptPath);

  assert.match(layout, /manifest:\s*"\/manifest\.webmanifest"/);
  assert.match(layout, /viewport:\s*Viewport/);
  assert.match(layout, /themeColor:\s*"#10b981"/);
  assert.match(layout, /appleWebApp/);
  assert.match(layout, /ServiceWorkerRegister/);
  assert.doesNotMatch(hero, /InstallPrompt/);
  assert.match(prompt, /beforeinstallprompt/);
  assert.match(prompt, /event\.prompt\(\)/);
});

test("PWA-001 offline fallback and icon generator script exist", async () => {
  const offlinePath = "src/app/offline/page.tsx";
  const scriptPath = "scripts/generate-icons.mjs";
  assert.equal(existsSync(offlinePath), true, `${offlinePath} missing`);
  assert.equal(existsSync(scriptPath), true, `${scriptPath} missing`);

  const offline = await readText(offlinePath);
  const script = await readText(scriptPath);

  assert.match(offline, /离线|稍后再试/);
  assert.match(script, /writeFile|deflateSync/);
  assert.match(script, /icon-maskable-512\.png/);
});
