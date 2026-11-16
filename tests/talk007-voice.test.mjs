// Timestamp: 2026-11-15 14:15
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readText = (path) => readFileSync(path, "utf8");

test("TALK-007 single-shot /api/talk/voice supports Qwen-Omni direct audio with DeepSeek fallback", () => {
  const voiceLib = readText("src/lib/talk/deepseek-voice.ts");
  const omniLib = readText("src/lib/talk/qwen-omni.ts");
  const voiceRoute = readText("src/app/api/talk/voice/route.ts");

  assert.match(voiceLib, /\/v1\/tools\/asr/);
  assert.match(voiceLib, /\/v1\/tools\/tts/);
  assert.match(voiceLib, /transcribeAudioWithDeepSeek/);
  assert.match(voiceLib, /synthesizeAudioWithDeepSeek/);

  assert.match(omniLib, /qwen3-omni-flash/);
  assert.match(omniLib, /wrapPcm24kMonoToWav/);
  assert.match(omniLib, /talkDirectWithQwenOmni/);

  assert.match(voiceRoute, /getAuthedUserId/);
  assert.match(voiceRoute, /requireCredits/);
  assert.match(voiceRoute, /talkDirectWithQwenOmni/);
  assert.match(voiceRoute, /transcribeAudioWithDeepSeek/);
  assert.match(voiceRoute, /streamChatMessage/);
  assert.match(voiceRoute, /spendCredits/);
  assert.match(voiceRoute, /replyAudioBase64/);
});

test("TALK-008 dialogue prompts stay concise and natural like a real human conversation", () => {
  const chars = readText("src/lib/talk/characters.ts");
  const modelClient = readText("src/lib/talk/model-client.ts");
  const omniLib = readText("src/lib/talk/qwen-omni.ts");

  assert.doesNotMatch(chars, /Language teaching behaviour|Comportamiento pedagógico/);
  assert.match(modelClient, /NATURAL_CONVERSATION_RULES/);
  assert.match(modelClient, /max_tokens:\s*180/);
  assert.match(omniLib, /maxTokens:\s*160/);
  assert.match(omniLib, /maxTokens:\s*140/);
});
