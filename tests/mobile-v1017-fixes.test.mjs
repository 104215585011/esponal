// Timestamp: 2026-11-16 09:05
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PDFDocument, StandardFonts } from "pdf-lib";

import { joinPdfTextItems, parsePdfForReader } from "../src/lib/import/pdf.ts";
import {
  extractArticleParagraphsFromMarkdown,
  extractCoverUrlFromRssBlock,
  extractOgImageFromHtml,
  normalizeCoverUrl,
} from "../src/lib/rss-extract.ts";
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

test("joinPdfTextItems merges soft PDF line breaks into natural paragraphs", () => {
  const joined = joinPdfTextItems([
    { str: "El aprendizaje de idiomas requiere", transform: [1, 0, 0, 12, 50, 700], hasEOL: true },
    { str: "constancia diaria y buena lectura.", transform: [1, 0, 0, 12, 50, 686], hasEOL: true },
    { str: "Capítulo segundo: La rutina.", transform: [1, 0, 0, 12, 50, 650], hasEOL: true },
  ]);
  assert.match(joined, /requiere constancia diaria y buena lectura\.\n\nCapítulo segundo/);
});

test("extractArticleParagraphsFromMarkdown strips navigation noise and extracts body paragraphs", () => {
  const sample = `Title: Noticia de prueba
URL Source: https://www.rfi.fr/es/test

Markdown Content:
* [Inicio](https://www.rfi.fr/es/)
* [Portada](https://www.rfi.fr/es/)

Fuente de la imagen, AFP

[](https://www.rfi.fr/es/empty-anchor)[](https://www.rfi.fr/es/empty-anchor-2)

Los aeropuertos estadounidenses reanudaron las operaciones comerciales este viernes tras varias horas de retrasos en las terminales principales del país.

Las autoridades señalaron que [el tráfico aéreo](https://www.rfi.fr/es/tag) volverá a la normalidad de forma gradual durante el fin de semana.
`;
  const paras = extractArticleParagraphsFromMarkdown(sample, 10);
  assert.equal(paras.length, 2);
  assert.match(paras[0], /^Los aeropuertos estadounidenses/);
  assert.doesNotMatch(paras[1], /https:\/\/www\.rfi\.fr/);
});

test("podcast audio proxy, 30s subtitles, multi-lang TTS, lectura translate, and all-shelf docs expose expected contracts", () => {
  const audioProxy = readText("src/app/api/listening/audio/route.ts");
  const subtitleRoute = readText("src/app/api/listening/subtitles/route.ts");
  const ttsRoute = readText("src/app/api/tts/route.ts");
  const uploadRoute = readText("src/app/api/import/upload/route.ts");
  const pdfRoute = readText("src/app/api/import/[id]/pdf/route.ts");
  const docsRoute = readText("src/app/api/import/documents/route.ts");
  const translateRoute = readText("src/app/api/lectura/translate/route.ts");

  assert.match(audioProxy, /isAllowedPodcastAudioUrl/);
  assert.match(audioProxy, /Accept-Ranges/);

  assert.match(subtitleRoute, /qwen3-omni-flash/);
  assert.match(subtitleRoute, /listening:sub:v3:/);
  assert.match(subtitleRoute, /WINDOW_SEC = 30/);

  assert.match(ttsRoute, /en-US-JennyNeural/);
  assert.match(ttsRoute, /fr-FR-DeniseNeural/);
  assert.match(ttsRoute, /ja-JP-NanamiNeural/);

  assert.match(uploadRoute, /fileBase64/);
  assert.match(uploadRoute, /export const runtime = "nodejs"/);
  assert.match(uploadRoute, /export const maxDuration = 60/);

  assert.match(pdfRoute, /parsePdfForReader/);
  assert.match(pdfRoute, /getImportedDocumentFileByIdForUser/);

  assert.match(docsRoute, /searchParams\.get\("all"\)/);
  assert.match(translateRoute, /translateTextToZh/);
  assert.match(translateRoute, /lectura:zh:v1:/);

  const imageRoute = readText("src/app/api/listening/image/route.ts");
  assert.match(imageRoute, /isAllowedPodcastAudioUrl/);
  assert.match(imageRoute, /image\//);
});

test("cover extraction normalizes itunes:image, media:thumbnail, BBC HD size, and og:image", () => {
  const bbcUrl = normalizeCoverUrl(
    "http://ichef.bbci.co.uk/ace/ws/240/cpsprodpb/test.jpg",
  );
  assert.equal(bbcUrl, "https://ichef.bbci.co.uk/ace/ws/800/cpsprodpb/test.jpg");

  const rssCover = extractCoverUrlFromRssBlock(
    '<item><title>Demo</title><media:thumbnail width="240" url="https://s.rfi.fr/media/demo.jpg"/></item>',
  );
  assert.equal(rssCover, "https://s.rfi.fr/media/demo.jpg");

  const itunesCover = extractCoverUrlFromRssBlock(
    '<channel><itunes:image href="https://www.hoyhablamos.com/cover.jpg" /></channel>',
  );
  assert.equal(itunesCover, "https://www.hoyhablamos.com/cover.jpg");

  const og = extractOgImageFromHtml(
    '<html><head><meta property="og:image" content="/wp-content/uploads/ep2400.webp" /></head></html>',
    "https://www.hoyhablamos.com/2400-el-efecto-halo/",
  );
  assert.equal(og, "https://www.hoyhablamos.com/wp-content/uploads/ep2400.webp");
});
