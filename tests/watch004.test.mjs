import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("WATCH-004 transcript panel defines sentence grouping primitives", async () => {
  const transcriptPanelPath = "src/app/watch/TranscriptPanel.tsx";
  assert.ok(existsSync(transcriptPanelPath), `${transcriptPanelPath} should exist`);

  const transcriptPanel = await readText(transcriptPanelPath);

  assert.match(transcriptPanel, /type SentenceGroup = \{/);
  assert.match(transcriptPanel, /function groupCuesIntoSentences\(cues: SubtitleCue\[\]\)/);
  assert.match(transcriptPanel, /startIndex:\s*number/);
  assert.match(transcriptPanel, /endIndex:\s*number/);
  assert.match(transcriptPanel, /MAX_CUES_PER_SENTENCE/);
});

test("WATCH-004 transcript panel translates and virtualizes by sentence groups", async () => {
  const transcriptPanel = await readText("src/app/watch/TranscriptPanel.tsx");

  assert.match(transcriptPanel, /const sentenceGroups = useMemo\(\(\) => groupCuesIntoSentences\(transcriptCues\), \[transcriptCues\]\)/);
  assert.match(transcriptPanel, /const activeSentenceIndex = useMemo/);
  assert.match(transcriptPanel, /renderedSentences/);
  assert.match(transcriptPanel, /renderedSentences\.map/);
  assert.match(transcriptPanel, /translateSentence\(/);
  assert.match(transcriptPanel, /translationCacheRef\.current\.get\(sentence\.text\)/);
  assert.match(transcriptPanel, /translations\[sentence\.startIndex\]/);
});

test("WATCH-004 transcript panel renders sentence-level Chinese blocks in all display modes", async () => {
  const transcriptPanel = await readText("src/app/watch/TranscriptPanel.tsx");

  assert.match(transcriptPanel, /group\/sentence/);
  assert.match(transcriptPanel, /pl-\[42px\]/);
  assert.match(transcriptPanel, /displayMode !== "chinese"/);
  assert.match(transcriptPanel, /displayMode !== "spanish"/);
  assert.match(transcriptPanel, /sentence\.cues\.map/);
  assert.match(transcriptPanel, /sentence\.cues\[0\]\.start/);
});

test("WATCH-004 transcript user-facing Chinese copy is not mojibake", async () => {
  const transcriptPanel = await readText("src/app/watch/TranscriptPanel.tsx");

  assert.match(transcriptPanel, /这个视频暂时没有高质量字幕/);
  assert.match(transcriptPanel, /Esponal 只能在有字幕的视频上工作/);
  assert.match(transcriptPanel, /这个视频没有字幕/);
  assert.match(transcriptPanel, /在 YouTube 打开/);
  assert.match(transcriptPanel, /安装扩展/);
  assert.match(transcriptPanel, /先去 YouTube 看/);
  assert.match(transcriptPanel, /回到当前位置/);
  assert.doesNotMatch(transcriptPanel, /鍙|瀛|閳|鈫|杩|瑁|鎵|�|\?{3,}/);
});
