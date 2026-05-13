import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

test("EXT-002 translate API route validates input, calls MiniMax, and caches subtitles", async () => {
  const routePath = "src/app/api/translate/route.ts";
  assert.ok(existsSync(routePath), `${routePath} should exist`);

  const route = await readText(routePath);

  assert.match(route, /export\s+async\s+function\s+POST/);
  assert.match(route, /NextResponse\.json/);
  assert.match(route, /text/);
  assert.match(route, /MINIMAX_API_KEY/);
  assert.match(route, /MINIMAX_GROUP_ID/);
  assert.match(route, /abab5\.5-chat/);
  assert.match(route, /subtitle:\$\{hashSubtitleText\(text\)\}/);
  assert.match(route, /60\s*\*\s*60\s*\*\s*24\s*\*\s*7/);
  assert.match(route, /redis\.get/);
  assert.match(route, /redis\.set/);
  assert.match(route, /chat\/completions/);
});

test("EXT-002 environment example documents MiniMax credentials", async () => {
  const env = await readText(".env.example");

  assert.match(env, /MINIMAX_API_KEY=/);
  assert.match(env, /MINIMAX_GROUP_ID=/);
});

test("EXT-002 manifest and popup support persistent Chinese subtitle toggling", async () => {
  const manifest = await readJson("extension/manifest.json");
  const popup = await readText("extension/popup.js");
  const popupHtml = await readText("extension/popup.html");

  assert.ok(manifest.permissions.includes("storage"));
  assert.ok(manifest.permissions.includes("activeTab"));
  assert.ok(manifest.host_permissions.includes("http://localhost:3000/*"));
  assert.match(popup, /chrome\.storage\.local/);
  assert.match(popup, /showChineseSubtitles/);
  assert.match(popup, /chrome\.tabs\.sendMessage/);
  assert.match(popup, /TOGGLE_CHINESE_SUBTITLES/);
  assert.match(popup, /chrome\.action\.setBadgeText/);
  assert.match(popup, /#9CA3AF/);
  assert.match(popupHtml, /toggleChinese/);
});

test("EXT-002 content script observes YouTube captions and injects reviewed overlay styling", async () => {
  const content = await readText("extension/content.js");

  assert.match(content, /http:\/\/localhost:3000\/api\/translate/);
  assert.match(content, /MutationObserver/);
  assert.match(content, /\.ytp-caption-segment/);
  assert.match(content, /\.html5-video-player/);
  assert.match(content, /esponal-subtitle-overlay/);
  assert.match(content, /position:\s*"absolute"/);
  assert.match(content, /zIndex:\s*"2147483640"/);
  assert.match(content, /bottom:\s*"60px"/);
  assert.match(content, /left:\s*"50%"/);
  assert.match(content, /translateX\(-50%\)/);
  assert.match(content, /maxWidth:\s*"90%"/);
  assert.match(content, /rgba\(255,\s*255,\s*255,\s*0\.75\)/);
  assert.match(content, /fontSize:\s*"15px"/);
  assert.match(content, /color:\s*"#FFFFFF"/);
  assert.match(content, /fontSize:\s*"18px"/);
  assert.match(content, /fontWeight:\s*"500"/);
  assert.match(content, /0 1px 4px rgba\(0,0,0,0\.85\), 0 0 8px rgba\(0,0,0,0\.6\)/);
  assert.match(content, /backgroundColor:\s*"transparent"/);
  assert.match(content, /opacity 200ms ease, max-height 200ms ease/);
  assert.match(content, /chrome\.storage\.local/);
  assert.match(content, /chrome\.runtime\.onMessage/);
  assert.match(content, /TOGGLE_CHINESE_SUBTITLES/);
  assert.match(content, /maxHeight:\s*showChineseSubtitles \? "2em" : "0"/);
});
