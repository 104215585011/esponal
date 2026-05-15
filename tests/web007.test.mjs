import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("WEB-007 transcript panel exposes transcript, tabs, and seek contract", async () => {
  const transcriptPanelPath = "src/app/watch/TranscriptPanel.tsx";
  assert.ok(existsSync(transcriptPanelPath), `${transcriptPanelPath} should exist`);

  const transcriptPanel = await readText(transcriptPanelPath);

  assert.match(transcriptPanel, /export function TranscriptPanel/);
  assert.match(transcriptPanel, /videoId:\s*string/);
  assert.match(transcriptPanel, /ES \+ 中|ES\+中/);
  assert.match(transcriptPanel, /仅西语/);
  assert.match(transcriptPanel, /仅中文/);
  assert.match(transcriptPanel, /scrollIntoView/);
  assert.match(transcriptPanel, /\/api\/translate/);
  assert.match(transcriptPanel, /LookupCard/);
  assert.match(transcriptPanel, /seekTo|onSeek/);
  assert.match(transcriptPanel, /visibleCueRange/);
  assert.match(transcriptPanel, /visibleCues/);
  assert.match(transcriptPanel, /renderedCues/);
  assert.match(transcriptPanel, /block:\s*"center"/);
  assert.doesNotMatch(transcriptPanel, /subtitleCues\.map\(\(cue,\s*index\)/);
});

test("WEB-007 related panel exposes hover and pin behavior contract", async () => {
  const relatedPanelPath = "src/app/watch/RelatedPanel.tsx";
  assert.ok(existsSync(relatedPanelPath), `${relatedPanelPath} should exist`);

  const relatedPanel = await readText(relatedPanelPath);

  assert.match(relatedPanel, /export function RelatedPanel/);
  assert.match(relatedPanel, /relatedVideos:\s*YouTubeVideoPayload\[\]/);
  assert.match(relatedPanel, /setTimeout/);
  assert.match(relatedPanel, /120/);
  assert.match(relatedPanel, /300/);
  assert.match(relatedPanel, /pinned/);
  assert.match(relatedPanel, /right-0|right: 0/);
});
