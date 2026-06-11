import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("MOBILE-R-PERF watch mobile throttles transcript time without touching player controls", async () => {
  const mobileLayout = await readText("src/app/watch/WatchMobileLayout.tsx");

  assert.match(mobileLayout, /useThrottledPlaybackTime/);
  assert.match(mobileLayout, /const transcriptClockSec = useThrottledPlaybackTime\(currentTimeSec, 250\)/);
  assert.match(mobileLayout, /currentTimeSec=\{transcriptClockSec\}/);
  assert.match(mobileLayout, /value=\{currentTimeSec\}/);
  assert.match(mobileLayout, /formatTimestamp\(currentTimeSec\)/);
  assert.match(mobileLayout, /handlePlayPause=\{handleMobilePlayPause\}|handlePlayPause\(\)/);
});

test("MOBILE-R-PERF transcript removes mobile blur and documents measured hotspots", async () => {
  const transcriptPanel = await readText("src/app/watch/TranscriptPanel.tsx");
  const featureList = await readText("feature_list.json");

  assert.doesNotMatch(transcriptPanel, /blur-\[0\.3px\]/);
  assert.match(transcriptPanel, /opacity-35 scale-\[0\.98\] hover:opacity-55/);
  assert.match(featureList, /MOBILE-R-PERF/);
  assert.match(featureList, /timeupdate/);
  assert.match(featureList, /blur/);
});
