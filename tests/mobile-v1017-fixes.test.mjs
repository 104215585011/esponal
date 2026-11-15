// Timestamp: 2026-11-15 14:15
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PDFDocument, StandardFonts } from "pdf-lib";

import { parsePdfForReader } from "../src/lib/import/pdf.ts";
import { parseOmniAnalysisJson, wrapPcm24kMonoToWav } from "../src/lib/talk/omni-helpers.ts";

const readText = (path) => readFileSync(path, "utf8");

test("qwen-omni wraps raw 24kHz PCM into valid RIFF WAV and idempotently preserves existing RIFF", () => {
  const rawPcm = Buffer.from([1, 2, 3, 4, 5, 6]);
  const wav = wrapPcm24kMonoToWav(rawPcm);

  assert.equal(wav.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(wav.subarray(8, 12).toString("ascii"), "WAVE");
  assert.equal(wav.readUInt32LE(24), 24_000);
  assert.equal(wav.readUInt16LE(22), 1);
  assert.equal(wav.length, 44 + rawPcm.length);

  assert.equal(wrapPcm24kMonoToWav(wav), wav);
});

test("parseOmniAnalysisJson extracts fenced JSON notes cleanly and degrades on malformed input", () => {
  const parsed = parseOmniAnalysisJson(`\`\`\`json
  {"userTranscript": "Hola Carlos", "corrections": ["Use bien instead of bueno"], "newWords": ["saludar"]}
  \`\`\``);
  assert.equal(parsed.userTranscript, "Hola Carlos");
  assert.deepEqual(parsed.corrections, ["Use bien instead of bueno"]);
  assert.deepEqual(parsed.newWords, ["saludar"]);

  const broken = parseOmniAnalysisJson("not json");
  assert.deepEqual(broken, { userTranscript: "", corrections: [], newWords: [] });
});

test("parsePdfForReader extracts per-page text and total page count from a generated PDF", async () => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([400, 300]);
  page.drawText("Buenos dias amigo", { x: 40, y: 200, size: 16, font });
  const bytes = await doc.save();

  const result = await parsePdfForReader(bytes);
  assert.equal(result.unitCount, 1);
  assert.equal(result.pages.length, 1);
  assert.equal(result.pages[0].pageNumber, 1);
  assert.match(result.pages[0].text, /Buenos dias amigo/);
});

test("/api/vocab/add fills safe defaults for mobile lookup payload while preserving validation", () => {
  const route = readText("src/app/api/vocab/add/route.ts");
  assert.match(route, /body\.meaning/);
  assert.match(route, /app:\/\/mobile\/lookup/);
  assert.match(route, /missing required fields/);
});

test("podcast audio proxy, AI subtitles, multi-lang TTS, and PDF reader routes expose expected contracts", () => {
  const audioProxy = readText("src/app/api/listening/audio/route.ts");
  const subtitleRoute = readText("src/app/api/listening/subtitles/route.ts");
  const ttsRoute = readText("src/app/api/tts/route.ts");
  const uploadRoute = readText("src/app/api/import/upload/route.ts");
  const pdfRoute = readText("src/app/api/import/[id]/pdf/route.ts");

  assert.match(audioProxy, /isAllowedPodcastAudioUrl/);
  assert.match(audioProxy, /Accept-Ranges/);

  assert.match(subtitleRoute, /qwen3-omni-flash/);
  assert.match(subtitleRoute, /listening:sub:v2:/);

  assert.match(ttsRoute, /en-US-JennyNeural/);
  assert.match(ttsRoute, /fr-FR-DeniseNeural/);
  assert.match(ttsRoute, /ja-JP-NanamiNeural/);

  assert.match(uploadRoute, /fileBase64/);
  assert.match(uploadRoute, /export const runtime = "nodejs"/);
  assert.match(uploadRoute, /export const maxDuration = 60/);

  assert.match(pdfRoute, /parsePdfForReader/);
  assert.match(pdfRoute, /getImportedDocumentFileByIdForUser/);
});
