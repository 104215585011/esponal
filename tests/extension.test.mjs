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
  assert.deepEqual(manifest.host_permissions, ["https://localhost:3000/*"]);
  assert.deepEqual(manifest.permissions, ["activeTab", "storage"]);
});

test("extension content script injects only on YouTube watch pages", async () => {
  const manifest = await readJson("extension/manifest.json");
  const [contentScript] = manifest.content_scripts;

  assert.deepEqual(contentScript.matches, ["https://www.youtube.com/watch*"]);
  assert.deepEqual(contentScript.js, ["content.js"]);
  assert.equal(contentScript.run_at, "document_idle");
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
  assert.match(content, /https:\/\/localhost:3000\/api\//);
  assert.match(content, /esponal-extension-ready/);
  assert.match(popup, /Esponal/);
  assert.match(popupScript, /chrome\.tabs\.create/);
});

test("extension has an esbuild package scaffold", async () => {
  const pkg = await readJson("extension/package.json");

  assert.equal(pkg.private, true);
  assert.equal(pkg.scripts.build, "esbuild background.js content.js popup.js --bundle --outdir=dist --format=iife");
  assert.ok(pkg.devDependencies.esbuild);
});
