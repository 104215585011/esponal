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
  assert.match(route, /APIFY_API_TOKEN/);
  assert.match(route, /api\.apify\.com/);
  assert.match(route, /downloadSubtitles/);
  assert.match(route, /subtitlesFormat:\s*["']srt["']/);
  assert.match(route, /parseSrt/);
  assert.match(route, /redis\.get/);
  assert.match(route, /redis\.set/);
  assert.match(route, /\[subtitle\] Apify fetched/);
  assert.doesNotMatch(route, /YoutubeTranscript/);
  assert.ok(!pkg.dependencies["youtube-transcript"]);
});

test("WEB-004 transcript panel exists and watch page no longer mounts SubtitlePanel", async () => {
  const transcriptPanelPath = "src/app/watch/TranscriptPanel.tsx";
  const watchPagePath = "src/app/watch/page.tsx";
  const subtitlePanelPath = "src/app/watch/SubtitlePanel.tsx";

  assert.ok(existsSync(transcriptPanelPath), `${transcriptPanelPath} should exist`);
  assert.ok(existsSync(watchPagePath), `${watchPagePath} should exist`);
  assert.ok(existsSync(subtitlePanelPath), `${subtitlePanelPath} should still exist`);

  const transcriptPanel = await readText(transcriptPanelPath);
  const watchPage = await readText(watchPagePath);

  assert.match(transcriptPanel, /\/api\/subtitle/);
  assert.match(transcriptPanel, /\/api\/translate/);
  assert.match(transcriptPanel, /LookupCard/);
  assert.match(transcriptPanel, /currentTimeSec/);
  assert.match(transcriptPanel, /seekTo|onSeek/);
  assert.match(watchPage, /TranscriptPanel/);
  assert.match(watchPage, /RelatedPanel/);
  assert.doesNotMatch(watchPage, /<SubtitlePanel/);
  assert.doesNotMatch(watchPage, /from\s+["']\.\/SubtitlePanel["']/);
});
