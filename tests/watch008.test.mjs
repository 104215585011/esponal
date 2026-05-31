import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("WATCH-008 replaces print download with direct SRT download", async () => {
  const transcript = await readText("src/app/watch/TranscriptPanel.tsx");
  const globals = await readText("src/app/globals.css");

  assert.match(transcript, /handleSrtDownload/);
  assert.match(transcript, /Blob\(/);
  assert.match(transcript, /URL\.createObjectURL/);
  assert.match(transcript, /\.srt/);
  assert.match(transcript, /download =/);
  assert.match(transcript, /text\/plain;charset=utf-8/);
  assert.doesNotMatch(transcript, /window\.print\(\)/);
  assert.doesNotMatch(transcript, /handlePrintDownload/);
  assert.doesNotMatch(transcript, /print-transcript-area/);
  assert.doesNotMatch(globals, /@media print|print-transcript-area|page-break-avoid/);
});

test("WATCH-008 formats SRT timestamps with comma milliseconds", async () => {
  const transcript = await readText("src/app/watch/TranscriptPanel.tsx");

  assert.match(transcript, /function formatSrtTimestamp\(seconds: number\)/);
  assert.match(transcript, /Math\.floor\(totalMilliseconds \/ 3600000\)/);
  assert.match(transcript, /String\(totalMilliseconds % 1000\)\.padStart\(3, "0"\)/);
  assert.match(transcript, /\$\{hours\}:\$\{minutes\}:\$\{secs\},\$\{milliseconds\}/);
  assert.match(transcript, /formatSrtTimestamp\(row\.start\).*-->|-->\s*\$\{formatSrtTimestamp\(row\.end\)\}/s);
});

test("WATCH-008 SRT rows come from complete transcript arrays and follow both modes", async () => {
  const transcript = await readText("src/app/watch/TranscriptPanel.tsx");

  assert.match(transcript, /const srtRows = useMemo/);
  assert.match(transcript, /sentenceGroups\.map\(\(sentence\)/);
  assert.match(transcript, /\(sentence\.cues\[sentence\.cues\.length - 1\]\?\.start/);
  assert.match(transcript, /\(sentence\.cues\[sentence\.cues\.length - 1\]\?\.dur/);
  assert.match(transcript, /transcriptCues\.map\(\(cue, index\)/);
  assert.doesNotMatch(transcript, /renderedSentences\.map\(\(sentence\).*srtRows/s);
  assert.doesNotMatch(transcript, /renderedCueRows\.map\(\(cue.*srtRows/s);
});

test("WATCH-008 SRT content follows display mode and strips blank blocks", async () => {
  const transcript = await readText("src/app/watch/TranscriptPanel.tsx");

  assert.match(transcript, /displayMode !== "chinese"/);
  assert.match(transcript, /displayMode !== "spanish"/);
  assert.match(transcript, /\.filter\(\(line\) => line\.trim\(\)\.length > 0\)/);
  assert.match(transcript, /\.filter\(\(block\) => block\.lines\.length > 0\)/);
});
