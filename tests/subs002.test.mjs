import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";

const readText = (path) => readFile(path, "utf8");

test("SUBS-002 subtitle route retains Supadata as a fallback subtitle source", async () => {
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
  assert.match(route, /apifyCues = await fetchHybridSubtitles/);
  assert.match(route, /return \{ cues: whisperCues, source: "whisper" \}/);
  assert.match(route, /return \{ cues: apifyCues, source: "apify" \}/);
  assert.match(route, /return \{ cues: supadataCues, source: "supadata" \}/);
});

async function runFallback({ youtube = [], supadata = [], apify = [], whisper = [], apifyEnabled = false, force = false }) {
  const route = await readText("src/app/api/subtitle/route.ts");
  const code = route.slice(route.indexOf("function getMaxCueGap("), route.indexOf("export async function GET("));
  const calls = [];
  const provider = (name, cues) => async (videoId, lang) => {
    calls.push({ name, videoId, lang });
    return cues;
  };
  const context = vm.createContext({
    MIN_REASONABLE_CUE_COUNT: 6,
    MAX_REASONABLE_CUE_GAP_SEC: 25,
    APIFY_ENABLED: apifyEnabled,
    fetchYouTubeInnerTubeSubtitles: provider("youtube", youtube),
    fetchSupadataSubtitles: provider("supadata", supadata),
    fetchHybridSubtitles: provider("apify", apify),
    getLocalWhisperSubtitles: provider("whisper", whisper),
    console: { log() {}, warn() {} }
  });
  vm.runInContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  const result = await context.fetchSubtitlesWithFallback("test-video", "de", force);
  assert.ok(calls.every((call) => call.videoId === "test-video" && call.lang === "de"));
  return { result, calls: calls.map((call) => call.name) };
}

const completeCues = Array.from({ length: 6 }, (_, i) => ({ start: i * 3, dur: 3, text: `cue ${i}` }));

test("native subtitles avoid paid calls when usable", async () => {
  const { result, calls } = await runFallback({ youtube: completeCues, supadata: completeCues });
  assert.deepEqual(calls, ["youtube"]);
  assert.equal(result.source, "youtube");
  assert.equal(result.cues, completeCues);
});

test("missing or sparse native subtitles fall back to Supadata", async () => {
  for (const youtube of [[], completeCues.slice(0, 1)]) {
    const { result, calls } = await runFallback({ youtube, supadata: completeCues });
    assert.deepEqual(calls, ["youtube", "supadata"]);
    assert.equal(result.source, "supadata");
  }
});

test("Apify remains opt-in before Whisper, and forced Whisper bypasses subtitle providers", async () => {
  const apify = await runFallback({ apify: completeCues, apifyEnabled: true });
  assert.deepEqual(apify.calls, ["youtube", "supadata", "apify"]);
  assert.equal(apify.result.source, "apify");
  const normal = await runFallback({ whisper: completeCues });
  assert.deepEqual(normal.calls, ["youtube", "supadata", "whisper"]);
  assert.equal(normal.result.source, "whisper");
  const forced = await runFallback({ youtube: completeCues, whisper: completeCues, force: true });
  assert.deepEqual(forced.calls, ["whisper"]);
  assert.equal(forced.result.source, "whisper");
});

test("all providers empty return none and sparse native subtitles remain a last resort", async () => {
  const empty = await runFallback({});
  assert.equal(empty.result.source, "none");
  assert.equal(empty.result.cues.length, 0);
  const sparseCues = completeCues.slice(0, 1);
  const sparse = await runFallback({ youtube: sparseCues });
  assert.deepEqual(sparse.calls, ["youtube", "supadata", "whisper"]);
  assert.equal(sparse.result.source, "youtube");
  assert.equal(sparse.result.cues, sparseCues);
});

test("SUBS-002 env example documents the Supadata API key placeholder", async () => {
  const envExample = await readText(".env.example");

  assert.match(envExample, /SUPADATA_API_KEY=""/);
});
