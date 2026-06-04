// Timestamp: 2026-06-04 10:37
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import test from "node:test";

async function readText(path) {
  return readFileSync(path, "utf8");
}

test("PHON-002 adds a phonics intro module above the alphabet grid", async () => {
  const pagePath = "src/app/phonics/page.tsx";
  const introPath = "src/app/phonics/PhonicsIntro.tsx";

  assert.ok(existsSync(pagePath), "/phonics page should exist");
  assert.ok(existsSync(introPath), "PhonicsIntro component should exist");

  const page = await readText(pagePath);
  const intro = await readText(introPath);

  assert.match(page, /PhonicsIntro/);
  assert.match(page, /md:mb-10/);
  assert.match(page, /border-b border-zinc-100 pb-8/);
  assert.ok(
    page.indexOf("<PhonicsIntro />") < page.indexOf("<AlphabetGrid"),
    "intro should render above alphabet grid"
  );

  assert.match(intro, /发音基础/);
  assert.match(intro, /Vocales/);
  assert.match(intro, /Vocales fuertes/);
  assert.match(intro, /Vocales d[ée]biles/);
  assert.match(intro, /Consonantes/);
  assert.match(intro, /Diptongo/);
});

test("PHON-002 exposes vowel, strong-weak, and diphthong data with audio-backed examples", async () => {
  const dataPath = "content/phonics/foundations.ts";
  const introPath = "src/app/phonics/PhonicsIntro.tsx";
  assert.ok(existsSync(dataPath), "phonics foundations data file should exist");
  assert.ok(existsSync(introPath), "phonics intro component should exist");

  const source = await readText(dataPath);
  const intro = await readText(introPath);

  assert.match(source, /export type PhonicsVowel/);
  assert.match(source, /export const PHONICS_VOWELS/);
  assert.match(source, /symbol:\s*"a"/);
  assert.match(source, /symbol:\s*"u"/);
  assert.match(source, /PHONICS_STRONG_VOWELS/);
  assert.match(source, /PHONICS_WEAK_VOWELS/);
  assert.match(source, /bueno/);
  assert.match(source, /ciudad/);
  assert.match(source, /aire/);
  assert.match(intro, /text-brand-600 font-semibold|font-semibold text-brand-600/);
});

test("PHON-002 audio generation covers intro words and reuses vowel letter audio", async () => {
  const source = await readText("scripts/generate-phonics-audio.mjs");
  const foundations = await readText("content/phonics/foundations.ts");

  assert.match(source, /foundations/i);
  assert.match(source, /PHONICS_FOUNDATION_AUDIO_WORDS/);
  assert.match(source, /public.+audio.+phonics/);
  assert.match(source, /letters/);
  assert.match(source, /words/);
  assert.match(foundations, /bueno/);
  assert.match(foundations, /ciudad/);
  assert.match(foundations, /aire/);

  for (const filePath of [
    "public/audio/phonics/words/bueno.mp3",
    "public/audio/phonics/words/ciudad.mp3",
    "public/audio/phonics/words/aire.mp3"
  ]) {
    assert.ok(existsSync(filePath), `${filePath} should exist`);
    assert.ok(statSync(filePath).size > 1024, `${filePath} should be a non-trivial mp3`);
  }
});
