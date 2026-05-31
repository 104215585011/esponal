import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("WATCH-007 transcript panel exposes sentence and cue loading modes", async () => {
  const source = await readText("src/app/watch/TranscriptPanel.tsx");

  assert.match(source, /type TranscriptMode = "sentence" \| "cue"/);
  assert.match(source, /useState<TranscriptMode>\("sentence"\)/);
  assert.match(source, /esponal_transcript_mode/);
  assert.match(source, /localStorage\.getItem\("esponal_transcript_mode"\)/);
  assert.match(source, /localStorage\.setItem\("esponal_transcript_mode", mode\)/);
  assert.match(source, /handleTranscriptModeChange/);
  assert.match(source, /setFollowMode\(true\)/);
  assert.match(source, /transcriptMode === "sentence"/);
  assert.match(source, /transcriptMode === "cue"/);
  assert.match(source, /renderedCueRows\.map/);
});

test("WATCH-007 toolbar contains display mode, loading mode, and download controls", async () => {
  const source = await readText("src/app/watch/TranscriptPanel.tsx");

  assert.match(source, /flex flex-wrap items-center justify-between gap-3/);
  assert.match(source, /ES \+ 中/);
  assert.match(source, /仅西语/);
  assert.match(source, /仅中文/);
  assert.match(source, /句子级/);
  assert.match(source, /逐行/);
  assert.match(source, /handlePrintDownload/);
  assert.match(source, /下载/);
  assert.match(source, /aria-label="下载当前字幕为 PDF"/);
});

test("WATCH-007 print download uses browser print view instead of jsPDF", async () => {
  const transcript = await readText("src/app/watch/TranscriptPanel.tsx");
  const globals = await readText("src/app/globals.css");
  const packageJson = await readText("package.json");

  assert.doesNotMatch(packageJson, /jspdf/i);
  assert.doesNotMatch(transcript, /from "jspdf"|from 'jspdf'|jsPDF/);
  assert.match(transcript, /id="print-transcript-area"/);
  assert.match(transcript, /window\.print\(\)/);
  assert.match(transcript, /document\.title = originalTitle/);
  assert.match(transcript, /printRows\.map/);
  assert.match(transcript, /formatTimestamp\(row\.start\)/);
  assert.match(globals, /@media print/);
  assert.match(globals, /#print-transcript-area/);
  assert.match(globals, /\.page-break-avoid/);
});

test("WATCH-007 print rows follow display and transcript modes without mojibake", async () => {
  const source = await readText("src/app/watch/TranscriptPanel.tsx");

  assert.match(source, /const printRows = useMemo/);
  assert.match(source, /displayMode !== "chinese"/);
  assert.match(source, /displayMode !== "spanish"/);
  assert.match(source, /transcriptMode === "sentence" \? sentenceGroups\.map/);
  assert.match(source, /transcriptCues\.map/);
  const mojibakePattern = new RegExp(
    [0x9365, 0x9225, 0x95b3, 0x95c2].map((codePoint) => String.fromCodePoint(codePoint)).join("|"),
  );
  assert.doesNotMatch(source, mojibakePattern);
});
