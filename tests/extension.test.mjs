import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const readText = (path) => readFile(path, "utf8");

test("extension declares a Manifest V3 Chrome extension", async () => {
  const manifest = await readJson("extension/manifest.json");

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.name, "Esponal");
  assert.equal(manifest.action.default_popup, "popup.html");
  assert.equal(manifest.background.service_worker, "background.js");
  assert.deepEqual(manifest.host_permissions, [
    "http://localhost:3000/*",
    "https://localhost:3000/*",
    "https://*.vercel.app/*",
    "https://www.youtube.com/*"
  ]);
  assert.deepEqual(manifest.permissions, ["activeTab", "storage"]);
});

test("extension content scripts cover YouTube harvesting and Esponal site detection", async () => {
  const manifest = await readJson("extension/manifest.json");
  const [youtubeScript, siteScript] = manifest.content_scripts;

  assert.deepEqual(youtubeScript.matches, ["https://www.youtube.com/watch*"]);
  assert.deepEqual(youtubeScript.js, ["content.js", "dist/harvest.js"]);
  assert.equal(youtubeScript.run_at, "document_idle");
  assert.deepEqual(siteScript.matches, [
    "http://localhost:3000/*",
    "https://*.vercel.app/*"
  ]);
  assert.deepEqual(siteScript.js, ["dist/esponal-site.js"]);
  assert.equal(siteScript.run_at, "document_idle");
});

test("extension files provide background, content, and popup behavior", async () => {
  for (const path of [
    "extension/background.js",
    "extension/content.js",
    "extension/popup.html",
    "extension/popup.js"
  ]) {
    assert.ok(existsSync(path), `${path} should exist`);
  }

  const background = await readText("extension/background.js");
  const content = await readText("extension/content.js");
  const popup = await readText("extension/popup.html");
  const popupScript = await readText("extension/popup.js");

  assert.match(background, /Esponal extension service worker started/);
  assert.match(content, /http:\/\/localhost:3000\/api\/translate/);
  assert.match(content, /esponal-extension-ready/);
  assert.match(popup, /Esponal/);
  assert.match(popupScript, /chrome\.tabs\.create/);
  assert.match(popupScript, /chrome\.storage\.local/);
  assert.match(popupScript, /TOGGLE_CHINESE_SUBTITLES/);
});

test("extension has an esbuild package scaffold", async () => {
  const pkg = await readJson("extension/package.json");
  const buildScript = await readText("extension/scripts/build.mjs");

  assert.equal(pkg.private, true);
  assert.match(pkg.scripts.build, /scripts\/build\.mjs/);
  assert.match(buildScript, /esbuild/);
  assert.match(buildScript, /harvest\.js/);
  assert.ok(pkg.devDependencies.esbuild);
});
