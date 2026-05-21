import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const dictionaryPath = "data/function-words.json";
const validatorPath = "scripts/validate-function-words.mjs";

const readDictionary = async () => JSON.parse(await readFile(dictionaryPath, "utf8"));

test("COURSE-005 Phase 1 function-word dictionary exists with attribution metadata", async () => {
  assert.ok(existsSync(dictionaryPath), "data/function-words.json should exist");

  const dictionary = await readDictionary();

  assert.equal(dictionary._meta.source, "Wiktionary (https://en.wiktionary.org)");
  assert.equal(dictionary._meta.license, "CC-BY-SA 3.0");
  assert.match(dictionary._meta.lastUpdated, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(dictionary.entries && typeof dictionary.entries === "object");
});

test("COURSE-005 Phase 1 dictionary has enough complete entries", async () => {
  const dictionary = await readDictionary();
  const entries = Object.entries(dictionary.entries);

  assert.ok(entries.length >= 60, `expected at least 60 entries, got ${entries.length}`);

  for (const [lemma, entry] of entries) {
    assert.equal(typeof entry.category, "string", `${lemma} category`);
    assert.equal(typeof entry.english, "string", `${lemma} english`);
    assert.ok(Array.isArray(entry.chinese) && entry.chinese.length > 0, `${lemma} chinese`);
    assert.ok(Array.isArray(entry.examples) && entry.examples.length >= 2, `${lemma} examples`);
    assert.equal(typeof entry.esEnContrast, "string", `${lemma} esEnContrast`);
    assert.equal(typeof entry.frequencyRank, "number", `${lemma} frequencyRank`);

    for (const example of entry.examples) {
      assert.equal(typeof example.es, "string", `${lemma} example es`);
      assert.equal(typeof example.en, "string", `${lemma} example en`);
      assert.equal(typeof example.zh, "string", `${lemma} example zh`);
      assert.notEqual(example.es.trim(), "", `${lemma} example es`);
      assert.notEqual(example.en.trim(), "", `${lemma} example en`);
      assert.notEqual(example.zh.trim(), "", `${lemma} example zh`);
    }
  }
});

test("COURSE-005 Phase 1 dictionary covers required categories and PM-anchored words", async () => {
  const dictionary = await readDictionary();
  const entries = dictionary.entries;
  const categories = new Set(Object.values(entries).map((entry) => entry.category));
  const expectedCategories = [
    "subject_pronoun",
    "reflexive",
    "object_pronoun",
    "article_definite",
    "article_indefinite",
    "preposition",
    "conjunction",
    "demonstrative",
    "possessive",
    "relative_interrogative"
  ];
  const requiredWords = [
    "el",
    "la",
    "un",
    "una",
    "con",
    "de",
    "en",
    "a",
    "por",
    "para",
    "se",
    "me",
    "te",
    "lo",
    "que",
    "este",
    "yo",
    "mi",
    "y"
  ];

  for (const category of expectedCategories) {
    assert.ok(categories.has(category), `missing category ${category}`);
  }

  for (const word of requiredWords) {
    assert.ok(entries[word], `missing required word ${word}`);
  }
});

test("COURSE-005 Phase 1 validator script passes the dictionary", () => {
  assert.ok(existsSync(validatorPath), "validator script should exist");

  const result = spawnSync(process.execPath, [validatorPath], {
    cwd: process.cwd(),
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Function-word dictionary valid/);
});

test("COURSE-005 Phase 1 exposes an npm validator command", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));

  assert.equal(
    packageJson.scripts["validate:function-words"],
    "node scripts/validate-function-words.mjs"
  );
});
