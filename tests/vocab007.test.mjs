import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readText = (p) => readFile(p, "utf8");

test("VOCAB-007 AI lemmatizer prompt identifies lemma from surface form", async () => {
  const src = await readText("src/lib/dictionary.ts");
  assert.match(src, /Identify its lemma/);
  assert.match(src, /"lemma":"tener"/);
});

test("VOCAB-007 RawAIEntry type includes lemma and morphInfo fields", async () => {
  const src = await readText("src/lib/dictionary.ts");
  assert.match(src, /lemma\?:\s*string/);
  assert.match(src, /morphInfo\?:\s*string/);
});

test("VOCAB-007 lookupDictionary uses v3 cache namespace and AI-returned lemma", async () => {
  const src = await readText("src/lib/dictionary.ts");
  assert.match(src, /vocab:dict:v3:/);
  assert.doesNotMatch(src, /vocab:dict:v2:/);
  assert.match(src, /parsed\.lemma/);
  assert.match(src, /aiLemma/);
});

test("VOCAB-007 falls back to hintLemma when AI returns no lemma field", async () => {
  const src = await readText("src/lib/dictionary.ts");
  assert.match(src, /hintLemma/);
  assert.match(src, /typeof parsed\.lemma/);
});

test("VOCAB-007 second cache check uses AI-returned lemma before writing", async () => {
  const src = await readText("src/lib/dictionary.ts");
  const getCalls = (src.match(/await safeCacheGet/g) ?? []).length;
  assert.ok(getCalls >= 2, `Expected >=2 safeCacheGet calls, got ${getCalls}`);
});
