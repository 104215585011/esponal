import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("WEB-008 transcript panel renders a virtual cue window", async () => {
  const transcriptPanelPath = "src/app/watch/TranscriptPanel.tsx";
  assert.ok(existsSync(transcriptPanelPath), `${transcriptPanelPath} should exist`);

  const transcriptPanel = await readText(transcriptPanelPath);

  assert.match(transcriptPanel, /INITIAL_RENDER_COUNT\s*=\s*\d+/);
  assert.match(transcriptPanel, /LOAD_MORE_BATCH\s*=\s*\d+/);
  assert.match(transcriptPanel, /renderStart/);
  assert.match(transcriptPanel, /renderEnd/);
  assert.match(transcriptPanel, /renderedCues\.map/);
  assert.match(transcriptPanel, /data-cue-index/);
  assert.doesNotMatch(transcriptPanel, /subtitleCues\.map\(\(cue,\s*index\)/);
});

test("WEB-008 transcript panel expands with sentinels and preserves follow mode", async () => {
  const transcriptPanel = await readText("src/app/watch/TranscriptPanel.tsx");

  assert.match(transcriptPanel, /IntersectionObserver/);
  assert.match(transcriptPanel, /topSentinelRef/);
  assert.match(transcriptPanel, /bottomSentinelRef/);
  assert.match(transcriptPanel, /scrollTop\s*=/);
  assert.match(transcriptPanel, /scrollHeight/);
  assert.match(transcriptPanel, /followMode/);
  assert.match(transcriptPanel, /wheel/);
  assert.match(transcriptPanel, /touchmove/);
  assert.doesNotMatch(transcriptPanel, /onScroll=/);
  assert.match(transcriptPanel, /scrollIntoView\(\{\s*behavior:\s*"smooth",\s*block:\s*"center"\s*\}\)/);
});
