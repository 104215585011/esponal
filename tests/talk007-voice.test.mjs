// Timestamp: 2026-11-15 08:15
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readText = (path) => readFileSync(path, "utf8");

test("TALK-007 single-shot /api/talk/voice uses DeepSeek ASR/TTS and keeps credits guarded", () => {
  const voiceLib = readText("src/lib/talk/deepseek-voice.ts");
  const voiceRoute = readText("src/app/api/talk/voice/route.ts");

  assert.match(voiceLib, /\/v1\/tools\/asr/);
  assert.match(voiceLib, /\/v1\/tools\/tts/);
  assert.match(voiceLib, /transcribeAudioWithDeepSeek/);
  assert.match(voiceLib, /synthesizeAudioWithDeepSeek/);

  assert.match(voiceRoute, /getAuthedUserId/);
  assert.match(voiceRoute, /requireCredits/);
  assert.match(voiceRoute, /transcribeAudioWithDeepSeek/);
  assert.match(voiceRoute, /streamChatMessage/);
  assert.match(voiceRoute, /spendCredits/);
  assert.match(voiceRoute, /replyAudioBase64/);
});
