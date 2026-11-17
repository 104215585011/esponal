// Timestamp: 2026-11-17 23:08
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { enMorningCoffee } from "../content/lectura/en-morning-coffee.ts";
import { enLondonWeekend } from "../content/lectura/en-london-weekend.ts";
import { enBookshopRain } from "../content/lectura/en-bookshop-rain.ts";
import { frMatinAParis } from "../content/lectura/fr-matin-a-paris.ts";
import { frMarcheDimanche } from "../content/lectura/fr-marche-dimanche.ts";
import { frVoyageTrain } from "../content/lectura/fr-voyage-train.ts";
import { jaAsaNoKoohii } from "../content/lectura/ja-asa-no-koohii.ts";
import { jaKyotoSanpo } from "../content/lectura/ja-kyoto-sanpo.ts";
import { jaSuperKaimono } from "../content/lectura/ja-super-kaimono.ts";
import { isAllowedPodcastAudioUrl } from "../src/lib/listening-audio.ts";
import {
  buildVideoFeedPayload,
  inferSingleVideoLevel,
} from "../src/lib/video-pool-logic.ts";

test("video-pool-logic supports en / fr / ja cross-channel starter feeds and level classification", () => {
  const jaN5 = inferSingleVideoLevel(
    {
      id: "wItsg1V4g0s",
      title: "Japanese Listening Practice for Beginners (JLPT N5)",
      thumbnail: "",
      duration: "PT5M",
      channelTitle: "Japanese with Shun",
      publishedAt: "",
    },
    "UCu6sZrHyl4hSS2PvlUo2XZA",
    "ja"
  );
  const jaN3 = inferSingleVideoLevel(
    {
      id: "jaN3Sample",
      title: "Natural Conversation for JLPT N3 Learners",
      thumbnail: "",
      duration: "PT12M",
      channelTitle: "Miku Real Japanese",
      publishedAt: "",
    },
    "UCsQCbl3a9FtYvA55BxdzYiQ",
    "ja"
  );

  assert.equal(jaN5.level, "A1");
  assert.equal(jaN3.level, "B1");

  const enFeed = buildVideoFeedPayload({
    language: "en",
    channels: [
      { id: "UCHaHD477h-FeBbVh9Sh7syA", title: "BBC Learning English", language: "en", tag: "英音精讲", description: "" },
      { id: "UCKyTokYo0nK2OA-az-sDijA", title: "VOA Learning English", language: "en", tag: "慢速英语", description: "" },
    ],
    rawByChannel: [],
    seed: 1,
  });
  assert.equal(enFeed.language, "en");
  assert.ok(enFeed.videos.length >= 2);
  assert.ok(enFeed.videos.every((item) => item.language === "en"));

  const frFeed = buildVideoFeedPayload({
    language: "fr",
    channels: [
      { id: "UCoUWq2QawqdC3-nRXKk-JUw", title: "Easy French", language: "fr", tag: "街头真实法语", description: "" },
      { id: "UCQpM25U6iqaRSO-SZxd5oDw", title: "Français Authentique", language: "fr", tag: "自然法语播客", description: "" },
      { id: "UCI4xp8qHD1MDErkqxb1dPbA", title: "innerFrench", language: "fr", tag: "中速可理解法语", description: "" },
    ],
    rawByChannel: [],
    seed: 1,
  });
  assert.equal(frFeed.language, "fr");
  assert.ok(frFeed.videos.length >= 3);
  assert.ok(frFeed.videos.every((item) => item.language === "fr"));

  const jaFeed = buildVideoFeedPayload({
    language: "ja",
    channels: [
      { id: "UCu6sZrHyl4hSS2PvlUo2XZA", title: "Japanese with Shun", language: "ja", tag: "初级日语", description: "" },
    ],
    rawByChannel: [],
    seed: 1,
  });
  assert.equal(jaFeed.language, "ja");
  assert.ok(jaFeed.videos.length >= 2);
  assert.ok(jaFeed.videos.every((item) => item.language === "ja"));
});

test("channels, podcasts, audio allowlist, dictionary, and RSS crawler cover en / fr / ja", async () => {
  const channelsSrc = await readFile("src/lib/channels.ts", "utf8");
  assert.match(channelsSrc, /englishCuratedChannels/);
  assert.match(channelsSrc, /frenchCuratedChannels/);
  assert.match(channelsSrc, /japaneseCuratedChannels/);
  assert.match(channelsSrc, /UCoUWq2QawqdC3-nRXKk-JUw/);
  assert.match(channelsSrc, /UCu6sZrHyl4hSS2PvlUo2XZA/);

  const podcastsSrc = await readFile("src/lib/podcasts.ts", "utf8");
  assert.match(podcastsSrc, /id:\s*"bbc-6-minute-english"/);
  assert.match(podcastsSrc, /id:\s*"innerfrench"/);
  assert.match(podcastsSrc, /id:\s*"rfi-francais-facile"/);
  assert.match(podcastsSrc, /id:\s*"nihongo-con-teppei"/);
  assert.match(podcastsSrc, /id:\s*"japanese-with-shun"/);

  assert.ok(isAllowedPodcastAudioUrl("https://bbc.pdn.tritondigital.com/p02pc9tn.mp3"));
  assert.ok(isAllowedPodcastAudioUrl("https://cdn.audiomeans.fr/rfi-episode.mp3"));
  assert.ok(isAllowedPodcastAudioUrl("https://stream.redcircle.com/episodes/sample.mp3"));
  assert.ok(isAllowedPodcastAudioUrl("http://nihongoconteppei.com/feed/podcast"));

  const transcriptSrc = await readFile("src/lib/podcast-transcript.ts", "utf8");
  assert.match(transcriptSrc, /\[。！？\]/);

  const dictSrc = await readFile("src/lib/dictionary.ts", "utf8");
  assert.match(dictSrc, /language === "ja"/);
  assert.match(dictSrc, /language === "fr"/);
  assert.match(dictSrc, /phonetic:\s*aiPhonetic/);

  const crawlerSrc = await readFile("src/lib/lectura/rss-crawler.ts", "utf8");
  assert.match(crawlerSrc, /theguardian\.com\/world\/rss/);
  assert.match(crawlerSrc, /rfi\.fr\/fr\/rss/);
  assert.match(crawlerSrc, /nhk\.or\.jp\/rss\/news\/cat0\.xml/);
  assert.match(crawlerSrc, /effectiveUnits/);
});

test("curated en / fr / ja reading stories register valid paragraphs and glossaries", async () => {
  const enStories = [enMorningCoffee, enLondonWeekend, enBookshopRain];
  const frStories = [frMatinAParis, frMarcheDimanche, frVoyageTrain];
  const jaStories = [jaAsaNoKoohii, jaKyotoSanpo, jaSuperKaimono];

  for (const s of enStories) {
    assert.equal(s.language, "en");
    assert.ok(s.paragraphs.length >= 5);
    assert.ok((s.glossary?.length ?? 0) >= 4);
  }
  for (const s of frStories) {
    assert.equal(s.language, "fr");
    assert.ok(s.paragraphs.length >= 5);
    assert.ok((s.glossary?.length ?? 0) >= 4);
  }
  for (const s of jaStories) {
    assert.equal(s.language, "ja");
    assert.ok(s.paragraphs.length >= 5);
    assert.ok((s.glossary?.length ?? 0) >= 4);
  }

  const indexSrc = await readFile("content/lectura/index.ts", "utf8");
  for (const symbol of [
    "enMorningCoffee",
    "frMatinAParis",
    "jaAsaNoKoohii",
    "jaSuperKaimono",
  ]) {
    assert.match(indexSrc, new RegExp(symbol));
  }
});
