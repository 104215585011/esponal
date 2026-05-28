// Timestamp: 2026-05-28 16:18
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const readText = (path) => readFile(path, "utf8");

test("LEX-001 Phase 2 adds Tatoeba download and parse scripts", async () => {
  assert.ok(existsSync("scripts/lexicon/download-tatoeba.mjs"));
  assert.ok(existsSync("scripts/lexicon/parse-tatoeba.mjs"));

  const download = await readText("scripts/lexicon/download-tatoeba.mjs");
  assert.match(download, /sentences\.csv\.bz2/);
  assert.match(download, /links\.csv\.bz2/);
  assert.match(download, /--skip-if-exists/);
  assert.match(download, /data\/tatoeba/);
  assert.match(download, /createBunzip/);
  assert.match(download, /countLines/);

  const parse = await readText("scripts/lexicon/parse-tatoeba.mjs");
  assert.match(parse, /sentences\.csv/);
  assert.match(parse, /links\.csv/);
  assert.match(parse, /tatoeba-es-zh\.jsonl/);
  assert.match(parse, /createReadStream/);
  assert.match(parse, /readline/);
  assert.match(parse, /100000/);
});

test("LEX-001 Phase 2 adds A1-A2 seed script controls and DeepSeek path", async () => {
  assert.ok(existsSync("scripts/lexicon/seed-a1-a2-words.mjs"));
  const seed = await readText("scripts/lexicon/seed-a1-a2-words.mjs");

  assert.match(seed, /--limit/);
  assert.match(seed, /--resume/);
  assert.match(seed, /--concurrency/);
  assert.match(seed, /--dry-run/);
  assert.match(seed, /lexicon-progress\.json/);
  assert.match(seed, /foundationLessons/);
  assert.match(seed, /tryConjugateVerb/);
  assert.match(seed, /DEEPSEEK_API_KEY/);
  assert.match(seed, /upsertLexiconEntry/);
  assert.match(seed, /sources:\s*\["tatoeba",\s*"llm-deepseek"\]/);
  assert.match(seed, /licenseCode:\s*"CC-BY-2\.0-FR"/);
});

test("LEX-001 Phase 2 ignores large local Tatoeba data", async () => {
  const gitignore = await readText(".gitignore");
  assert.match(gitignore, /data\/tatoeba\//);
  assert.match(gitignore, /data\/tatoeba-es-zh\.jsonl/);
  assert.match(gitignore, /data\/lexicon-progress\.json/);
});
