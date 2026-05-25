import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import test from "node:test";

async function readText(path) {
  return readFileSync(path, "utf8");
}

test("PHON-003 extends alphabet data with pronunciation rules for variable letters", async () => {
  const source = await readText("content/phonics/alphabet.ts");

  assert.match(source, /export type PronunciationRule/);
  assert.match(source, /rules\?: PronunciationRule\[]/);
  assert.match(source, /condition:\s*"在 e \/ i 前"/);
  assert.match(source, /syllables:\s*\["ce", "ci"\]/);
  assert.match(source, /condition:\s*"组成 ch"/);
  assert.match(source, /condition:\s*"组成 ll"/);
  assert.match(source, /condition:\s*"词首或 l\/n\/s 后"/);
  assert.match(source, /condition:\s*"作连词 y 时"/);
  assert.match(source, /condition:\s*"墨西哥等词里"/);
});

test("PHON-003 uses a modal rule viewer instead of inline grid expansion", async () => {
  const grid = await readText("src/app/phonics/AlphabetGrid.tsx");

  assert.match(grid, /selectedLetter/);
  assert.match(grid, /查看发音/);
  assert.match(grid, /bg-brand-400 rounded-full/);
  assert.match(grid, /fixed inset-0 z-50/);
  assert.match(grid, /lg:max-w-lg|sm:max-w-lg/);
  assert.match(grid, /rounded-t-card|rounded-card/);
  assert.match(grid, /\/audio\/phonics\/syllables\/\$\{syllable\}\.mp3/);
  assert.match(grid, /rule\.words/);
  assert.doesNotMatch(grid, /inline collapse/i);
});

test("PHON-003 audio generation covers syllable mp3 files and rule example words", async () => {
  const script = await readText("scripts/generate-phonics-audio.mjs");

  assert.match(script, /syllables/);
  assert.match(script, /rules/);
  assert.match(script, /public.+audio.+phonics/);

  for (const filePath of [
    "public/audio/phonics/syllables/ce.mp3",
    "public/audio/phonics/syllables/rr.mp3",
    "public/audio/phonics/syllables/gue.mp3"
  ]) {
    assert.ok(existsSync(filePath), `${filePath} should exist`);
    assert.ok(statSync(filePath).size > 1024, `${filePath} should be a non-trivial mp3`);
  }
});
