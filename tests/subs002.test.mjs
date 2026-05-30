import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("SUBS-002 subtitle route adds Supadata as the primary server subtitle source", async () => {
  const routePath = "src/app/api/subtitle/route.ts";
  assert.ok(existsSync(routePath), `${routePath} should exist`);

  const route = await readText(routePath);

  assert.match(route, /SUPADATA_API_KEY/);
  assert.match(route, /fetchSupadataSubtitles/);
  assert.match(route, /source:\s*"supadata"/);
  assert.match(route, /X-Subtitle-Source/);
  assert.match(route, /"supadata"\s*\|\s*"apify"\s*\|\s*"whisper"/);
});

test("SUBS-002 keeps the fallback order and forceWhisper bypass contract", async () => {
  const route = await readText("src/app/api/subtitle/route.ts");

  assert.match(route, /if\s*\(forceWhisper\)\s*{/);
  assert.match(route, /const supadataCues = await fetchSupadataSubtitles/);
  assert.match(route, /const apifyCues = await fetchHybridSubtitles/);
  assert.match(route, /return \{ cues: whisperCues, source: "whisper" \}/);
  assert.match(route, /return \{ cues: apifyCues, source: "apify" \}/);
  assert.match(route, /return \{ cues: supadataCues, source: "supadata" \}/);
});

test("SUBS-002 env example documents the Supadata API key placeholder", async () => {
  const envExample = await readText(".env.example");

  assert.match(envExample, /SUPADATA_API_KEY=""/);
});
