import { access, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const readText = (filePath) => readFile(filePath, "utf8");

test("TALK-006 recognize route uses the Whisper tunnel and fails open for fallback", async () => {
  await access("src/lib/talk/whisper-client.ts");
  const route = await readText("src/app/api/talk/recognize/route.ts");
  const client = await readText("src/lib/talk/whisper-client.ts");
  const speech = await readText("src/lib/talk/speech.ts");

  assert.match(route, /transcribeViaWhisperTunnel/);
  assert.match(route, /segments:\s*result\.segments/);
  assert.match(route, /provider:\s*result\.provider/);
  assert.match(route, /unavailableReason:\s*result\.unavailableReason/);
  assert.doesNotMatch(route, /recognizeSpeech/);
  assert.doesNotMatch(speech, /v1\/asr/);

  assert.match(client, /WHISPER_TUNNEL_URL/);
  assert.match(client, /\/transcribe/);
  assert.match(client, /audio_base64:\s*input\.audioBase64/);
  assert.match(client, /language:\s*input\.language\.split\("-"\)\[0\]/);
  assert.match(client, /suffix:\s*getAudioSuffix\(input\.mimeType\)/);
  assert.match(client, /setTimeout\([\s\S]*20_000/);
  assert.match(client, /provider:\s*"unavailable"/);
  assert.match(client, /unavailableReason:\s*"missing_env"/);
  assert.match(client, /unavailableReason:\s*`http_\$\{response\.status\}`/);
});

test("TALK-006 talk client records with MediaRecorder and only falls back to Web Speech", async () => {
  const client = await readText("src/app/talk/[characterId]/TalkClient.tsx");

  assert.match(client, /mediaRecorderRef/);
  assert.match(client, /audioChunksRef/);
  assert.match(client, /navigator\.mediaDevices\.getUserMedia\(\{\s*audio:\s*true\s*\}\)/);
  assert.match(client, /new MediaRecorder\(stream/);
  assert.match(client, /\/api\/talk\/recognize/);
  assert.match(client, /provider === "unavailable"/);
  assert.match(client, /payload\.unavailableReason/);
  assert.match(client, /startSpeechRecognitionFallback/);
  assert.match(client, /async function startRecording\(\)[\s\S]*new MediaRecorder\(stream/);
  assert.match(client, /recognizing/);
  assert.match(client, /recordingSeconds/);
});

test("TALK-006 documents tunnel env and operator steps", async () => {
  await access("docs/talk-whisper-tunnel.md");
  const env = await readText(".env.example");
  const doc = await readText("docs/talk-whisper-tunnel.md");

  assert.match(env, /WHISPER_TUNNEL_URL=/);
  assert.match(doc, /WHISPER_TUNNEL_URL/);
  assert.match(doc, /cloudflared/);
  assert.match(doc, /whisper_service\.py/);
  assert.match(doc, /trycloudflare/);
  assert.match(doc, /production/i);
});
