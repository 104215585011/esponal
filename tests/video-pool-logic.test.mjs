// Timestamp: 2026-11-17 16:25
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildVideoFeedPayload,
  inferSingleVideoLevel,
  mixVideosCrossChannel
} from "../src/lib/video-pool-logic.ts";

const ES_CHANNELS = [
  { id: "ch1", title: "Dreaming Spanish", language: "es", tag: "慢速可理解输入", description: "" },
  { id: "ch2", title: "Spanish Okay", language: "es", tag: "日常表达", description: "" },
  { id: "ch3", title: "Easy Spanish", language: "es", tag: "街头真实对话", description: "" }
];

const DE_CHANNELS = [
  { id: "UCxUWIEL-USsiPak0Qy6_vVg", title: "DW Deutsch lernen", language: "de", tag: "清晰德语原声", description: "" },
  { id: "UCaeT58uDMlPpBlwAYaxN0LA", title: "Learn German Original", language: "de", tag: "情景对话入门", description: "" },
  { id: "UCbxb2fqe9oNgglAoYqsYOtQ", title: "Easy German", language: "de", tag: "街头真实德语", description: "" }
];

test("single videos in the same channel can hold different CEFR levels", () => {
  const easyBeginner = inferSingleVideoLevel(
    {
      id: "5GoCkgdVqdo",
      title: "Simple Pronounciation Guide for Spanish Beginners (A1)",
      thumbnail: "",
      duration: "PT7M43S",
      channelTitle: "Easy Spanish",
      publishedAt: ""
    },
    "UCAL4AMMMXKxHDu3FqZV6CbQ",
    "es"
  );
  const easyIntermediate = inferSingleVideoLevel(
    {
      id: "ArNLvtcjf30",
      title: "Is Perfectionism Killing Your Spanish? (Intermediate Spanish Podcast)",
      thumbnail: "",
      duration: "PT21M33S",
      channelTitle: "Easy Spanish",
      publishedAt: ""
    },
    "UCAL4AMMMXKxHDu3FqZV6CbQ",
    "es"
  );

  assert.equal(easyBeginner.level, "A1");
  assert.equal(easyIntermediate.level, "A2");
});

test("cross-channel mixing interleaves creators and preserves deterministic order per seed", () => {
  const makeVid = (id, channelId) => ({
    id,
    title: id,
    thumbnail: "",
    duration: "PT2M",
    channelId,
    channelTitle: channelId,
    publishedAt: "",
    language: "es",
    level: "A1",
    topic: "日常"
  });

  const input = [
    { channel: ES_CHANNELS[0], videos: [makeVid("a1", "ch1"), makeVid("a2", "ch1")] },
    { channel: ES_CHANNELS[1], videos: [makeVid("b1", "ch2"), makeVid("b2", "ch2")] },
    { channel: ES_CHANNELS[2], videos: [makeVid("c1", "ch3"), makeVid("c2", "ch3")] }
  ];

  const run1 = mixVideosCrossChannel(input, 100);
  const run2 = mixVideosCrossChannel(input, 100);
  const rotated = mixVideosCrossChannel(input, 101);

  assert.deepEqual(run1.map((v) => v.id), run2.map((v) => v.id));
  assert.notEqual(run1[0].channelId, run1[1].channelId);
  assert.notEqual(run1[1].channelId, run1[2].channelId);
  assert.notDeepEqual(run1.map((v) => v.id), rotated.map((v) => v.id));
});

test("sparse level filter reports exact count and supplies nearby-level recommendations", () => {
  const payload = buildVideoFeedPayload({
    language: "de",
    channels: DE_CHANNELS,
    rawByChannel: [],
    level: "B1",
    seed: 10
  });

  // 首批德语手工核验池中 B1 仅 2 条 (< 3 条门槛，故 availableLevels 暂只开 A1/A2)
  assert.equal(payload.countsByLevel.B1, 2);
  assert.equal(payload.availableLevels.includes("B1"), false);
  assert.equal(payload.availableLevels.includes("A1"), true);
  assert.equal(payload.availableLevels.includes("A2"), true);
  assert.equal(payload.videos.length, 2);
  assert.equal(payload.isSparse, true);
  assert.equal(payload.nearbyLevel, "A2");
  assert.ok(payload.nearbyVideos.length > 0);
});
