// COURSE-001 change timestamp: 2026-05-13 13:54
import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const readText = (path) => readFile(path, "utf8");

test("COURSE-001 static curriculum content has pronunciation rules and seed words", async () => {
  const wordsPath = "content/curriculum/phase1-words.json";
  const rulesPath = "content/curriculum/pronunciation-rules.json";
  assert.ok(existsSync(wordsPath), `${wordsPath} should exist`);
  assert.ok(existsSync(rulesPath), `${rulesPath} should exist`);

  const words = await readJson(wordsPath);
  const rules = await readJson(rulesPath);

  assert.ok(Array.isArray(words.words), "words should be an array");
  assert.equal(words.words.length, 300, "phase one should include the full 300-word starter list");
  assert.equal(words.targetCount, 300);
  assert.match(words.expansionNote, /300/);

  const parts = new Set(words.words.map((word) => word.partOfSpeech));
  assert.ok(parts.has("noun"), "seed words should include nouns");
  assert.ok(parts.has("verb"), "seed words should include verbs");
  assert.ok(parts.has("adjective"), "seed words should include adjectives");

  for (const word of words.words) {
    assert.match(word.id, /^[a-z0-9-]+$/);
    assert.ok(word.spanish);
    assert.ok(word.chinese);
    assert.ok(word.example?.spanish);
    assert.ok(word.example?.chinese);
    assert.match(word.audioSrc, /^\/audio\/words\/[a-z0-9-]+\.wav$/);
    const audioPath = `public${word.audioSrc}`;
    assert.ok(existsSync(audioPath), `${audioPath} should exist`);
    assert.ok(statSync(audioPath).size > 1024, `${audioPath} should contain generated audio`);
    if (word.partOfSpeech === "noun") {
      assert.match(word.gender, /^(masculine|feminine)$/);
    }
  }

  assert.ok(Array.isArray(rules.rules), "rules should be an array");
  assert.ok(rules.rules.length >= 10, "pronunciation rules should be directly visible and complete enough");

  const coveredLetters = new Set(rules.rules.flatMap((rule) => rule.letters));
  for (const letter of "abcdefghijklmnñopqrstuvwxyz".split("")) {
    assert.ok(coveredLetters.has(letter), `pronunciation rules should cover ${letter}`);
  }

  for (const rule of rules.rules) {
    assert.ok(rule.titleChinese);
    assert.ok(rule.explanationChinese);
    assert.ok(rule.example?.spanish);
    assert.ok(rule.example?.chinesePronunciation);
  }
});

test("COURSE-001 page renders the approved no-pressure layout", async () => {
  const pagePath = "src/app/learn/phase-1/page.tsx";
  assert.ok(existsSync(pagePath), `${pagePath} should exist`);

  const page = await readText(pagePath);

  assert.match(page, /阶段一：入门词汇与发音/);
  assert.match(page, /发音规则/);
  assert.match(page, /高频词汇/);
  assert.match(page, /bg-app/);
  assert.match(page, /max-w-3xl/);
  assert.match(page, /px-4/);
  assert.match(page, /sm:px-8/);
  assert.match(page, /border-t border-gray-100/);
  assert.match(page, /flex flex-col gap-3/);
  assert.match(page, /rounded-xl shadow-sm border border-gray-100 p-4/);
  assert.match(page, /text-lg font-bold text-gray-900/);
  assert.match(page, /text-xs bg-gray-100 text-gray-500/);
  assert.match(page, /text-base text-gray-700/);
  assert.match(page, /text-sm text-gray-500 italic/);
  assert.match(page, /text-sm text-gray-400/);
  assert.match(page, /text-gray-400/);
  assert.match(page, /AudioButton/);
  assert.doesNotMatch(page, /进度|打卡|掌握|第\s*\{.*\}\s*\/|pagination|slice\(/);
});

test("COURSE-001 audio button is client-side and degrades when audio is absent", async () => {
  const componentPath = "src/app/components/audio/AudioButton.tsx";
  assert.ok(existsSync(componentPath), `${componentPath} should exist`);

  const source = await readText(componentPath);

  assert.match(source, /"use client"/);
  assert.match(source, /new Audio/);
  assert.match(source, /bg-brand-50/);
  assert.match(source, /bg-brand-100/);
  assert.match(source, /text-brand-600/);
  assert.match(source, /w-9 h-9/);
  assert.match(source, /min-w-\[44px\]|min-h-\[44px\]/);
  assert.match(source, /音频暂时不可用/);
  assert.match(source, /setUnavailable\(true\)/);
});
