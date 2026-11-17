// Timestamp: 2026-11-17 15:10
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  lookupCuratedGermanEntry,
  resolveGermanSeparableVerb
} from "../src/lib/german-lexicon.ts";
import { buildSearchCacheInput } from "../src/lib/youtube-search-params.ts";
import { isAllowedPodcastAudioUrl } from "../src/lib/listening-audio.ts";
import { deMorgenroutine } from "../content/lectura/de-morgenroutine.ts";

test("German language metadata and detection exist in languages.ts without breaking Spanish", async () => {
  const src = await readFile("src/lib/languages.ts", "utf8");
  assert.match(src, /SUPPORTED_LANGUAGES\s*=\s*\[[^\]]*"es"[^\]]*"de"/);
  assert.match(src, /de:\s*"德语"/);
  assert.match(src, /COMMON_GERMAN_ONLY_WORDS/);
});

test("German separable verbs lemmatize from full sentence context", () => {
  const fromStem = resolveGermanSeparableVerb(
    "stehe",
    "Ich stehe um sieben Uhr auf."
  );
  assert.equal(fromStem?.lemma, "aufstehen");

  const fromPrefix = resolveGermanSeparableVerb(
    "auf",
    "Ich stehe um sieben Uhr auf."
  );
  assert.equal(fromPrefix?.lemma, "aufstehen");

  const curated = lookupCuratedGermanEntry(
    "stehe",
    "Ich stehe um sieben Uhr auf."
  );
  assert.equal(curated?.lemma, "aufstehen");
  assert.ok(curated?.meanings.some((m) => m.includes("起床")));
});

test("German nouns return article and plural including umlaut plurals", () => {
  const sg = lookupCuratedGermanEntry("Fahrrad");
  assert.equal(sg?.lemma, "Fahrrad");
  assert.equal(sg?.nounForms?.gender, "n");
  assert.equal(sg?.nounForms?.singular, "das Fahrrad");
  assert.equal(sg?.nounForms?.plural, "die Fahrräder");

  const pl = lookupCuratedGermanEntry("Fahrräder");
  assert.equal(pl?.lemma, "Fahrrad");
  assert.equal(pl?.nounForms?.singular, "das Fahrrad");
  assert.equal(pl?.nounForms?.plural, "die Fahrräder");
});

test("YouTube search cache isolates non-Spanish languages while keeping Spanish default key", () => {
  const esKey = buildSearchCacheInput({
    query: "hallo welt",
    maxResults: 20,
    order: "relevance",
    region: "",
    pageToken: "",
    language: "es"
  });
  const deKey = buildSearchCacheInput({
    query: "hallo welt",
    maxResults: 20,
    order: "relevance",
    region: "",
    pageToken: "",
    language: "de"
  });
  assert.equal(esKey, "hallo welt:20");
  assert.notEqual(esKey, deKey);
  assert.ok(deKey.includes("lang:de"));
});

test("Podcast host allowlist permits Slow German MP3 and transcripts while blocking private hosts", () => {
  assert.ok(isAllowedPodcastAudioUrl("https://slowgerman.com/2026/05/episode/"));
  assert.ok(isAllowedPodcastAudioUrl("https://slowgerman.cdn.svmaudio.com/test.mp3"));
  assert.equal(isAllowedPodcastAudioUrl("http://127.0.0.1:8080/test.mp3"), null);
});

test("Curated German reading story exposes language=de and target separable verb", () => {
  assert.equal(deMorgenroutine.language, "de");
  assert.ok(
    deMorgenroutine.paragraphs.some((p) => p.includes("Ich stehe um sieben Uhr auf."))
  );
});
