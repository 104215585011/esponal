import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("WEB-004 subtitle route exists and fetches YouTube timedtext", async () => {
  const routePath = "src/app/api/subtitle/route.ts";
  assert.ok(existsSync(routePath), `${routePath} should exist`);

  const route = await readText(routePath);
  const pkg = JSON.parse(await readText("package.json"));

  assert.match(route, /export\s+async\s+function\s+GET/);
  assert.match(route, /runtime\s*=\s*["']edge["']/);
  assert.match(route, /timedtext/);
  assert.match(route, /type:\s*["']list["']/);
  assert.match(route, /lang_code/);
  assert.match(route, /fmt:\s*["']json3["']/);
  assert.match(route, /\[subtitle\] fetched/);
  assert.match(route, /\[subtitle\] edge fetch failed/);
  assert.doesNotMatch(route, /YoutubeTranscript/);
  assert.doesNotMatch(route, /getCachedJson/);
  assert.ok(!pkg.dependencies["youtube-transcript"]);
});

test("WEB-004 subtitle panel exists and contains player sync plus translate hooks", async () => {
  const panelPath = "src/app/watch/SubtitlePanel.tsx";
  assert.ok(existsSync(panelPath), `${panelPath} should exist`);

  const panel = await readText(panelPath);

  assert.match(panel, /getCurrentTime/);
  assert.match(panel, /setInterval/);
  assert.match(panel, /subtitleCuesRef/);
  assert.match(panel, /try\s*{[\s\S]*getCurrentTime/);
  assert.match(panel, /if\s*\(!playerRef\.current\)/);
  assert.match(panel, /\[iframeId,\s*videoId\]/);
  assert.doesNotMatch(panel, /\[iframeId,\s*subtitleCues,\s*videoId\]/);
  assert.match(panel, /\/api\/translate/);
  assert.match(panel, /origin:\s*window\.location\.origin/);
  assert.doesNotMatch(panel, /vercel\.app/);
  assert.match(panel, /text-white\/75/);
});
