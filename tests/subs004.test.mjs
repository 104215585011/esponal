import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("SUBS-004 subtitle route gates Apify behind APIFY_ENABLED (default off)", async () => {
  const routePath = "src/app/api/subtitle/route.ts";
  assert.ok(existsSync(routePath), `${routePath} should exist`);

  const route = await readText(routePath);

  // Switch constant: strict "1" opt-in, so default (unset/"0") is disabled.
  assert.match(route, /const APIFY_ENABLED = process\.env\.APIFY_ENABLED === "1"/);

  // Apify hybrid fetch must only run when the switch is enabled.
  assert.match(route, /if \(APIFY_ENABLED\)\s*{\s*[\s\S]*?fetchHybridSubtitles/);
});

test("SUBS-004 keeps Apify code intact (soft-off, not removed)", async () => {
  const route = await readText("src/app/api/subtitle/route.ts");

  // The Apify implementation is retained so it can be re-enabled via env.
  assert.match(route, /async function fetchHybridSubtitles/);
  assert.match(route, /async function callApify/);
  assert.match(route, /function mergeManualWithAsr/);
});

test("SUBS-004 preserves the Supadata-first ordering and Whisper fallback", async () => {
  const route = await readText("src/app/api/subtitle/route.ts");

  // Supadata is still attempted before the Apify gate.
  const supadataIdx = route.indexOf("const supadataCues = await fetchSupadataSubtitles");
  const gateIdx = route.indexOf("if (APIFY_ENABLED)");
  assert.ok(supadataIdx > -1 && gateIdx > -1 && supadataIdx < gateIdx);

  // Whisper fallback remains.
  assert.match(route, /getLocalWhisperSubtitles\(videoId, lang\)/);
});

test("SUBS-004 env example documents APIFY_ENABLED default-off", async () => {
  const envExample = await readText(".env.example");
  assert.match(envExample, /APIFY_ENABLED=""/);
});
