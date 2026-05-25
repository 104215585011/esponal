import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import test from "node:test";

async function readText(path) {
  return readFileSync(path, "utf8");
}

test("PHON-001 exposes 27 static Spanish alphabet entries including N tilde", async () => {
  const dataPath = "content/phonics/alphabet.ts";
  assert.ok(existsSync(dataPath), "alphabet data file should exist");

  const source = await readText(dataPath);
  assert.match(source, /export type AlphabetLetter/);
  assert.match(source, /export const SPANISH_ALPHABET/);
  assert.match(source, /letter:\s*"Ñ"/);
  assert.match(source, /letterLower:\s*"ñ"/);
  assert.match(source, /name:\s*"eñe"/);
  assert.match(source, /example:\s*"niño"/);
  assert.match(source, /exampleZh:\s*"男孩"/);

  const itemCount = (source.match(/letter:\s*"/g) ?? []).length;
  assert.equal(itemCount, 27);
});

test("PHON-001 page renders the approved alphabet layout and audio controls", async () => {
  const data = await readText("content/phonics/alphabet.ts");
  assert.match(data, /example:\s*"día"/);
  assert.match(data, /example:\s*"jamón"/);
  assert.match(data, /example:\s*"xilófono"/);

  const pagePath = "src/app/phonics/page.tsx";
  const clientPath = "src/app/phonics/AlphabetGrid.tsx";
  assert.ok(existsSync(pagePath), "/phonics page should exist");
  assert.ok(existsSync(clientPath), "alphabet grid client component should exist");

  const page = await readText(pagePath);
  const grid = await readText(clientPath);

  assert.match(page, /西语字母/);
  assert.match(page, /27 个字母 · 听一遍，就开始/);
  assert.match(page, /SPANISH_ALPHABET/);
  assert.doesNotMatch(page, /登录后可记录已学字母/);

  assert.match(grid, /grid-cols-3/);
  assert.match(grid, /sm:grid-cols-4/);
  assert.match(grid, /lg:grid-cols-5/);
  assert.doesNotMatch(grid, /lg:grid-cols-6/);
  assert.match(grid, /font-serif/);
  assert.match(grid, /text-\[56px\]|text-6xl|text-7xl/);
  assert.match(grid, /bg-brand-50/);
  assert.match(grid, /text-brand-700/);
  assert.match(grid, /西语独有/);
  assert.match(grid, /🔊 \{label\}/);
  assert.match(grid, /label=\{letter\.name\}/);
  assert.match(grid, /label=\{letter\.example\}/);
  assert.match(grid, /getPlaybackRate/);
  assert.match(grid, /\/audio\/phonics\/letters\/\$\{letter\.slug\}\.mp3/);
  assert.match(grid, /\/audio\/phonics\/words\/\$\{letter\.slug\}\.mp3/);
});

test("PHON-001 navigation exposes the alphabet entry before video", async () => {
  const siteNav = await readText("src/app/components/web/SiteNav.tsx");
  const mobileNav = await readText("src/app/components/web/MobileNav.tsx");

  for (const source of [siteNav, mobileNav]) {
    const alphabetIndex = source.indexOf('{ label: "字母", href: "/phonics" }');
    const videoIndex = source.indexOf('{ label: "视频", href: "/" }');
    assert.ok(alphabetIndex >= 0, "alphabet nav item should exist");
    assert.ok(videoIndex >= 0, "video nav item should exist");
    assert.ok(alphabetIndex < videoIndex, "alphabet nav item should be first");
  }
});

test("PHON-001 audio generation script targets 54 mp3 files with Dalia voice", async () => {
  const scriptPath = "scripts/generate-phonics-audio.mjs";
  assert.ok(existsSync(scriptPath), "phonics audio generation script should exist");

  const source = await readText(scriptPath);
  assert.match(source, /SPANISH_ALPHABET/);
  assert.match(source, /es-MX-DaliaNeural/);
  assert.match(source, /public.+audio.+phonics/);
  assert.match(source, /letters/);
  assert.match(source, /words/);
  assert.match(source, /AUDIO_24KHZ_48KBITRATE_MONO_MP3/);
});

test("PHON-001 commits generated letter and example audio assets", () => {
  const lettersDir = "public/audio/phonics/letters";
  const wordsDir = "public/audio/phonics/words";
  assert.ok(existsSync(lettersDir), "letter audio directory should exist");
  assert.ok(existsSync(wordsDir), "word audio directory should exist");

  const letterFiles = readdirSync(lettersDir).filter((file) => file.endsWith(".mp3"));
  const wordFiles = readdirSync(wordsDir).filter((file) => file.endsWith(".mp3"));
  assert.equal(letterFiles.length, 27);
  assert.ok(wordFiles.length >= 27);

  for (const slug of [
    "a",
    "b",
    "c",
    "d",
    "e",
    "f",
    "g",
    "h",
    "i",
    "j",
    "k",
    "l",
    "m",
    "n",
    "n-tilde",
    "o",
    "p",
    "q",
    "r",
    "s",
    "t",
    "u",
    "v",
    "w",
    "x",
    "y",
    "z"
  ]) {
    assert.ok(wordFiles.includes(`${slug}.mp3`), `${slug}.mp3 should remain present`);
  }

  for (const file of [...letterFiles.map((file) => `${lettersDir}/${file}`), ...wordFiles.map((file) => `${wordsDir}/${file}`)]) {
    assert.ok(statSync(file).size > 1024, `${file} should be a non-trivial mp3`);
  }
});

test("PHON-001 updates VISION Stage 0 to partially complete", async () => {
  const vision = await readText("VISION.md");

  assert.match(vision, /\| 0 入门 \| 🟢 部分完成/);
  assert.match(vision, /字母发音页/);
});
