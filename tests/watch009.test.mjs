import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("WATCH-009 replaces SRT download with programmatic PDF download", async () => {
  const transcript = await readText("src/app/watch/TranscriptPanel.tsx");

  assert.match(transcript, /handlePdfDownload/);
  assert.match(transcript, /buildPdfBytes/);
  assert.match(transcript, /application\/pdf/);
  assert.match(transcript, /\.pdf/);
  assert.match(transcript, /URL\.createObjectURL/);
  assert.match(transcript, /download =/);
  assert.doesNotMatch(transcript, /window\.print\(\)/);
  assert.doesNotMatch(transcript, /handlePrintDownload/);
  assert.doesNotMatch(transcript, /formatSrtTimestamp/);
  assert.doesNotMatch(transcript, /\.srt/);
  assert.doesNotMatch(transcript, /text\/plain;charset=utf-8/);
});

test("WATCH-009 PDF rows come from complete transcript arrays and follow both modes", async () => {
  const transcript = await readText("src/app/watch/TranscriptPanel.tsx");

  assert.match(transcript, /const pdfRows = useMemo/);
  assert.match(transcript, /sentenceGroups\.map\(\(sentence\)/);
  assert.match(transcript, /transcriptCues\.map\(\(cue, index\)/);
  assert.match(transcript, /displayMode !== "chinese"/);
  assert.match(transcript, /displayMode !== "spanish"/);
  assert.doesNotMatch(transcript, /renderedSentences\.map\(\(sentence\).*pdfRows/s);
  assert.doesNotMatch(transcript, /renderedCueRows\.map\(\(cue.*pdfRows/s);
});

test("WATCH-009 PDF renderer preserves timestamp and bilingual vertical layout", async () => {
  const transcript = await readText("src/app/watch/TranscriptPanel.tsx");

  assert.match(transcript, /formatTimestamp\(row\.start\)/);
  assert.match(transcript, /spanishLines/);
  assert.match(transcript, /chineseLines/);
  assert.match(transcript, /row\.spanish/);
  assert.match(transcript, /row\.chinese/);
  assert.match(transcript, /canvas\.getContext\("2d"\)/);
  assert.match(transcript, /toDataURL\("image\/jpeg"/);
});

test("WATCH-009 download button uses PDF copy and loading state", async () => {
  const transcript = await readText("src/app/watch/TranscriptPanel.tsx");

  assert.match(transcript, /isGeneratingPdf/);
  assert.match(transcript, /aria-label="下载当前字幕为 PDF 讲义"/);
  assert.match(transcript, /生成中\.\.\./);
  assert.match(transcript, /下载 PDF/);
  assert.match(transcript, /disabled=\{isGeneratingPdf\}/);
});

test("WATCH-009 PDF handout uses the video title instead of the raw video id", async () => {
  const transcript = await readText("src/app/watch/TranscriptPanel.tsx");
  const watchClient = await readText("src/app/watch/WatchClient.tsx");

  assert.match(transcript, /videoTitle\??: string/);
  assert.match(transcript, /function renderTranscriptPdfPages\(rows: PdfRow\[\], displayMode: DisplayMode, title: string\)/);
  assert.match(transcript, /context\.fillText\(title, PDF_MARGIN_X, 108\)/);
  assert.match(transcript, /const pdfTitle = videoTitle\?\.trim\(\) \|\| videoId/);
  assert.match(transcript, /renderTranscriptPdfPages\(completeRows, displayMode, pdfTitle\)/);
  assert.match(watchClient, /videoTitle=\{videoInfo\.title\}/);
});

test("WATCH-009 PDF download fills missing Chinese translations only when Chinese is requested", async () => {
  const transcript = await readText("src/app/watch/TranscriptPanel.tsx");

  assert.match(transcript, /translationIndex: number/);
  assert.match(transcript, /ensurePdfRowsHaveTranslations/);
  assert.match(transcript, /if \(displayMode === "spanish"\) return rows/);
  assert.match(transcript, /row\.chinese\.trim\(\)\.length === 0/);
  assert.match(transcript, /await fetchTranslationText\(row\.spanish\)/);
  assert.match(transcript, /setTranslations\(\(previous\) => \(\{ \.\.\.previous, \.\.\.nextTranslations \}\)\)/);
  assert.match(transcript, /const completeRows = await ensurePdfRowsHaveTranslations\(rows\)/);
  assert.match(transcript, /renderTranscriptPdfPages\(completeRows, displayMode, pdfTitle\)/);
});
