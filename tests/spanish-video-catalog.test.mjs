// Timestamp: 2026-11-18 10:22
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildVideoFeedPayload,
  enforceChannelWindowCap,
  inferSingleVideoLevel
} from "../src/lib/video-pool-logic.ts";
import {
  parseTimedTextXml,
  pickPreferredCaptionTrack
} from "../src/lib/youtube-subtitles.ts";

test("VideoCatalog schema & migration define shared deduplicated catalog table", async () => {
  const schema = await readFile("prisma/schema.prisma", "utf8");
  const migration = await readFile(
    "prisma/migrations/20261118100000_add_video_catalog/migration.sql",
    "utf8"
  );

  assert.match(schema, /enum VideoSubtitleStatus/);
  assert.match(schema, /model VideoCatalog[\s\S]*videoId\s+String\s+@unique/);
  assert.match(schema, /model VideoCatalog[\s\S]*subtitleStatus\s+VideoSubtitleStatus/);
  assert.match(schema, /@@map\("video_catalog"\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "video_catalog"/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS "video_catalog_videoId_key"/);
});

test("youtube-subtitles parses format=3 XML, strips rolling <s> tags, and prefers manual over ASR tracks", () => {
  const xml = `<?xml version="1.0" encoding="utf-8" ?><timedtext format="3"><body>
    <p t="3700" d="1710">Hola &amp; bienvenidos</p>
    <p t="5410" w="1" a="1">\n</p>
    <p t="6000" d="3000" w="1"><s>¿Cómo</s><s t="200"> estáis?</s></p>
  </body></timedtext>`;
  const cues = parseTimedTextXml(xml);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].text, "Hola & bienvenidos");
  assert.equal(cues[0].start, 3.7);
  assert.equal(cues[1].text, "¿Cómo estáis?");

  const chosen = pickPreferredCaptionTrack(
    [
      { languageCode: "en", kind: "standard", baseUrl: "https://ex/en" },
      { languageCode: "es", kind: "asr", baseUrl: "https://ex/es-asr" },
      { languageCode: "es-ES", baseUrl: "https://ex/es-manual" }
    ],
    "es"
  );
  assert.equal(chosen?.baseUrl, "https://ex/es-manual");
});

test("buildVideoFeedPayload prioritizes unseen videos, caps single-channel window share, and leaves weak ES evidence null", () => {
  const channels = [
    { id: "c1", title: "Channel 1", language: "es", tag: "慢速对话", description: "" },
    { id: "c2", title: "Channel 2", language: "es", tag: "日常生活", description: "" },
    { id: "c3", title: "Channel 3", language: "es", tag: "旅行探索", description: "" }
  ];

  // Weak evidence for Spanish without explicit CEFR or catalog metadata must remain null
  const weakEs = inferSingleVideoLevel(
    {
      id: "unknown1234",
      title: "Un día normal en Madrid",
      thumbnail: "",
      duration: "PT6M00S",
      channelTitle: "Channel 1",
      publishedAt: ""
    },
    "UCouyFdE9-Lrjo3M_2idKq1A",
    "es"
  );
  assert.equal(weakEs.level, null);

  const makeItems = (cid, count) =>
    Array.from({ length: count }, (_, i) => ({
      id: `${cid}-v${i}`,
      title: `${cid} video ${i}`,
      thumbnail: "",
      duration: "PT4M",
      channelId: cid,
      channelTitle: cid,
      publishedAt: "",
      level: i % 2 === 0 ? "A1" : "A2"
    }));

  const payload = buildVideoFeedPayload({
    language: "es",
    channels,
    rawByChannel: [
      { channelId: "c1", videos: makeItems("c1", 20) },
      { channelId: "c2", videos: makeItems("c2", 10) },
      { channelId: "c3", videos: makeItems("c3", 10) }
    ],
    viewedVideoIds: new Set(["c2-v0", "c3-v0"]),
    skipCuratedFallback: true,
    seed: 5
  });

  // Top unseen items must appear before any viewed item
  const firstViewedIdx = payload.videos.findIndex((v) => v.isViewed);
  assert.ok(firstViewedIdx > 0);
  assert.ok(payload.videos.slice(0, firstViewedIdx).every((v) => !v.isViewed));
  assert.ok(payload.videos.slice(firstViewedIdx).every((v) => v.isViewed));

  // Channel dominance cap inside top 24 window
  const capped = enforceChannelWindowCap(payload.videos, 24, 0.3);
  const c1InTop24 = capped.slice(0, 24).filter((v) => v.channelId === "c1").length;
  assert.ok(c1InTop24 <= 8, `Expected c1 <= 8 in top 24, got ${c1InTop24}`);
});

test("channels, catalog module, feed route, and subtitle route wire expanded sources and verification", async () => {
  const channelsSrc = await readFile("src/lib/channels.ts", "utf8");
  assert.match(channelsSrc, /SPANISH_CURATED_SOURCES/);
  assert.match(channelsSrc, /Español con Juan/);
  assert.match(channelsSrc, /Why Not Spanish\?/);
  assert.match(channelsSrc, /Hola Spanish/);

  const catalogSrc = await readFile("src/lib/video-catalog.ts", "utf8");
  assert.match(catalogSrc, /analyzeSpanishSubtitleCues/);
  assert.match(catalogSrc, /assessSpanishVideoLevel/);
  assert.match(catalogSrc, /recordCatalogSubtitleVerification/);

  const feedRouteSrc = await readFile("src/app/api/videos/feed/route.ts", "utf8");
  assert.match(feedRouteSrc, /userId/);

  const subtitleRouteSrc = await readFile("src/app/api/subtitle/route.ts", "utf8");
  assert.match(subtitleRouteSrc, /fetchYouTubeInnerTubeSubtitles/);
  assert.match(subtitleRouteSrc, /recordCatalogSubtitleVerification/);
});
