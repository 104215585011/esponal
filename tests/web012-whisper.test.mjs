import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("WEB-012 local Whisper helper is configurable and calls yt-dlp plus Python", async () => {
  const helperPath = "src/lib/localWhisper.ts";
  const scriptPath = "scripts/transcribe-whisper.py";
  const apiScriptPath = "scripts/local-whisper-api.py";

  assert.ok(existsSync(helperPath), `${helperPath} should exist`);
  assert.ok(existsSync(scriptPath), `${scriptPath} should exist`);
  assert.ok(existsSync(apiScriptPath), `${apiScriptPath} should exist`);

  const helper = await readText(helperPath);
  const script = await readText(scriptPath);
  const apiScript = await readText(apiScriptPath);

  assert.match(helper, /LOCAL_WHISPER_ENABLED/);
  assert.match(helper, /LOCAL_WHISPER_API_URL/);
  assert.match(helper, /LOCAL_WHISPER_API_TOKEN/);
  assert.match(helper, /LOCAL_WHISPER_PYTHON/);
  assert.match(helper, /LOCAL_WHISPER_MODEL_PATH/);
  assert.match(helper, /YTDLP_PATH/);
  assert.match(helper, /yt-dlp|YTDLP_PATH/);
  assert.match(helper, /spawn/);
  assert.match(helper, /fetchRemoteWhisperSubtitles/);
  assert.match(helper, /transcribe-whisper\.py/);
  assert.match(script, /whisper\.load_model/);
  assert.match(script, /language=.*es|language=args\.language/);
  assert.match(script, /json\.dump/);
  assert.match(apiScript, /HTTPServer/);
  assert.match(apiScript, /Authorization/);
  assert.match(apiScript, /Bearer/);
  assert.match(apiScript, /whisper\.load_model/);
  assert.match(apiScript, /yt-dlp/);
});

test("WEB-012 subtitle API falls back to local Whisper for empty or sparse cues", async () => {
  const route = await readText("src/app/api/subtitle/route.ts");

  assert.match(route, /getLocalWhisperSubtitles/);
  assert.match(route, /shouldUseWhisperFallback/);
  assert.match(route, /subtitle:v4:/);
  assert.match(route, /forceWhisper/);
  assert.match(route, /whisperCues\.length/);
  assert.match(route, /Apify fetched/);
});

test("WEB-012 env example documents local Whisper settings", async () => {
  const envExample = await readText(".env.example");

  assert.match(envExample, /LOCAL_WHISPER_ENABLED=/);
  assert.match(envExample, /LOCAL_WHISPER_API_URL=/);
  assert.match(envExample, /LOCAL_WHISPER_API_TOKEN=/);
  assert.match(envExample, /LOCAL_WHISPER_PYTHON=/);
  assert.match(envExample, /LOCAL_WHISPER_MODEL_PATH=/);
  assert.match(envExample, /YTDLP_PATH=/);
});
