import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("AUDIO-002 tts route exposes server-side msedge mp3 synthesis", async () => {
  const routePath = "src/app/api/tts/route.ts";
  assert.equal(existsSync(routePath), true, `${routePath} missing`);

  const route = await readText(routePath);
  assert.match(route, /export const runtime\s*=\s*"nodejs"/);
  assert.match(route, /export async function OPTIONS/);
  assert.match(route, /export async function GET/);
  assert.match(route, /MsEdgeTTS/);
  assert.match(route, /OUTPUT_FORMAT\.AUDIO_24KHZ_48KBITRATE_MONO_MP3/);
  assert.match(route, /es-MX-DaliaNeural/);
  assert.match(route, /Content-Type":\s*"audio\/mpeg"/);
});

test("AUDIO-002 tts route validates, rate-limits, and caches generated audio", async () => {
  const route = await readText("src/app/api/tts/route.ts");

  assert.match(route, /ttsLimiter/);
  assert.match(route, /checkRateLimit\(ttsLimiter/);
  assert.match(route, /getRetryAfterSec/);
  assert.match(route, /MAX_LEN\s*=\s*200/);
  assert.match(route, /status:\s*400/);
  assert.match(route, /createHash\("sha256"\)/);
  assert.match(route, /tts:\$\{hash\}/);
  assert.match(route, /redis\.get/);
  assert.match(route, /redis\.set/);
  assert.match(route, /CACHE_TTL/);
  assert.match(route, /Cache-Control/);
});

test("AUDIO-002 speak helper always uses the server tts endpoint", async () => {
  const helper = await readText("src/lib/speak.ts");

  assert.doesNotMatch(helper, /speechSynthesis/);
  assert.doesNotMatch(helper, /SpeechSynthesisUtterance/);
  assert.match(helper, /let currentAudio:\s*HTMLAudioElement \| null/);
  assert.match(helper, /new Audio\(`\/api\/tts\?text=\$\{encodeURIComponent\(text\)\}`\)/);
  assert.match(helper, /audio\.playbackRate\s*=/);
  assert.match(helper, /currentAudio\.pause\(\)/);
  assert.match(helper, /export function useSpeechAvailable\(\)/);
  assert.match(helper, /return true/);
});

test("AUDIO-002 rate limiter exports a dedicated tts limiter", async () => {
  const source = await readText("src/lib/ratelimit.ts");

  assert.match(source, /export const ttsLimiter\s*=\s*createLimiter\(60,\s*"rl:tts"\)/);
});

test("AUDIO-002 service worker cache-first handles tts audio", async () => {
  const sw = await readText("src/sw.ts");
  const publicSw = await readText("public/sw.js");

  for (const source of [sw, publicSw]) {
    assert.match(source, /TTS_AUDIO_CACHE/);
    assert.match(source, /\/api\/tts/);
    assert.match(source, /text=/);
    assert.match(source, /cache\.match\(request\)/);
    assert.match(source, /cache\.put\(request,\s*response\.clone\(\)\)/);
  }
});
