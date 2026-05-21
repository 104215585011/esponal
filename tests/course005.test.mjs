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
    "relative_interrogative",
    "indefinite_pronoun",
    "quantifier",
    "adverb_function"
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

const readSource = async (relativePath) => readFile(relativePath, "utf8");

test("COURSE-005 Phase 2 dissect route and client contract exist", async () => {
  const pageSource = await readSource("src/app/dissect/page.tsx");
  const clientSource = await readSource("src/app/dissect/DissectorClient.tsx");
  const tokenizeSource = await readSource("src/app/dissect/tokenize.ts");
  const libSource = await readSource("src/lib/functionWords.ts");

  assert.match(pageSource, /DissectorClient/);
  assert.match(pageSource, /SiteHeader/);
  assert.match(clientSource, /textarea/);
  assert.match(clientSource, /max-w-3xl/);
  assert.match(clientSource, /data-testid="dissect-input"/);
  assert.match(clientSource, /data-testid="dissect-output"/);
  assert.match(clientSource, /DEFAULT_DISSECT_SENTENCE/);
  assert.match(clientSource, /border-b-2/);
  assert.match(clientSource, /<sup/);
  assert.match(clientSource, /esEnContrast/);
  assert.match(clientSource, /getFoundationDayHref/);
  assert.match(libSource, /\/learn\/foundation\/day-\$\{day\}/);
  assert.match(tokenizeSource, /tokenizeSentence/);
  assert.match(libSource, /lookupFunctionWord/);
  assert.match(libSource, /getAggregationStyle/);
});

test("COURSE-005 Phase 2 aggregation covers PM QC categories and object_pronoun indigo", async () => {
  const libSource = await readSource("src/lib/functionWords.ts");

  assert.match(libSource, /indefinite_pronoun/);
  assert.match(libSource, /quantifier/);
  assert.match(libSource, /adverb_function/);
  assert.match(libSource, /border-blue-400/);
  assert.match(libSource, /border-indigo-400/);
  assert.match(libSource, /border-slate-400/);
  assert.match(libSource, /object_pronoun[\s\S]*indigo/);
});

test("COURSE-005 Phase 2 sample sentence lemmas exist in dictionary", async () => {
  const dictionary = await readDictionary();

  for (const lemma of ["yo", "me", "con", "las", "los"]) {
    assert.ok(dictionary.entries[lemma], `missing skeleton lemma ${lemma}`);
  }
});

test("COURSE-005 Phase 3 foundation content defines seven complete lessons", async () => {
  const contentSource = await readSource("src/content/foundation.ts");

  assert.match(contentSource, /foundationLessons/);
  assert.match(contentSource, /day:\s*1/);
  assert.match(contentSource, /day:\s*7/);
  assert.match(contentSource, /sections/);
  assert.match(contentSource, /comparisonRows/);
  assert.match(contentSource, /contrastBlocks/);
  assert.match(contentSource, /usageExamples/);

  const dayMatches = contentSource.match(/day:\s*\d/g) ?? [];
  assert.equal(dayMatches.length, 7, "foundationLessons should contain exactly 7 day entries");

  const sectionNames = ["引入", "对照表", "西英差异", "真实使用"];
  for (const name of sectionNames) {
    assert.match(contentSource, new RegExp(name), `missing ${name} section marker`);
  }

  const chineseCharCount = (contentSource.match(/[\u4e00-\u9fff]/g) ?? []).length;
  assert.ok(chineseCharCount >= 5600, `expected at least 5600 Chinese chars, got ${chineseCharCount}`);
});

test("COURSE-005 Phase 3 foundation overview route lists seven day cards", async () => {
  const pageSource = await readSource("src/app/learn/foundation/page.tsx");

  assert.match(pageSource, /SiteHeader/);
  assert.match(pageSource, /foundationLessons/);
  assert.match(pageSource, /grid gap-4 sm:grid-cols-2 lg:grid-cols-3/);
  assert.match(pageSource, /lg:col-span-2/);
  assert.match(pageSource, /推荐先读/);
  assert.match(pageSource, /\/learn\/foundation\/day-\$\{lesson\.day\}/);
});

test("COURSE-005 Phase 3 foundation day route renders all lesson sections and tri-link navigation", async () => {
  const pageSource = await readSource("src/app/learn/foundation/[day]/page.tsx");

  assert.match(pageSource, /generateStaticParams/);
  assert.match(pageSource, /foundationLessons/);
  assert.match(pageSource, /Day \{lesson\.day\} \/ 7/);
  assert.match(pageSource, /BackLink/);
  assert.match(pageSource, /comparisonRows/);
  assert.match(pageSource, /contrastBlocks/);
  assert.match(pageSource, /usageExamples/);
  assert.match(pageSource, /border-l-2 border-brand-200 pl-3/);
  assert.match(pageSource, /上一天/);
  assert.match(pageSource, /下一天/);
  assert.match(pageSource, /visibility: "hidden"/);
});

test("COURSE-005 Phase 3 learn overview exposes amber foundation banner under the hero", async () => {
  const learnSource = await readSource("src/app/learn/page.tsx");

  assert.match(learnSource, /href="\/learn\/foundation"/);
  assert.match(learnSource, /border-amber-200/);
  assert.match(learnSource, /bg-amber-50\/60/);
  assert.match(learnSource, /新手起步/);
  assert.match(learnSource, /7 天/);
});
