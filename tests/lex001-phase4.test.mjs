import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("LEX-001 Phase 4 lookup route checks LexiconEntry before external dictionary", async () => {
  const route = await readText("src/app/api/vocab/lookup/route.ts");

  assert.match(route, /findLexiconLookupEntry/);
  assert.match(route, /mapLexiconEntryToLookupPayload/);
  assert.match(route, /incrementLookupCount/);
  assert.match(route, /lookupDictionary/);
  assert.ok(
    route.indexOf("const lexiconEntry = await findLexiconLookupEntry") <
      route.indexOf("const entry = await lookupDictionary"),
    "local lexicon lookup should run before the external dictionary path"
  );
});

test("LEX-001 Phase 4 lookup route emits lexicon monitoring headers", async () => {
  const route = await readText("src/app/api/vocab/lookup/route.ts");

  assert.match(route, /X-Lexicon-Hit/);
  assert.match(route, /X-Lookup-Source/);
  assert.match(route, /X-Lookup-Latency-Ms/);
  assert.match(route, /lexiconHeaders/);
});

test("LEX-001 Phase 4 lexicon helpers support forms hit and related phrase search", async () => {
  const lexicon = await readText("src/lib/lexicon.ts");

  assert.match(lexicon, /findLexiconLookupEntry/);
  assert.match(lexicon, /kind:\s*"word"/);
  assert.match(lexicon, /forms:\s*\{\s*has:\s*normalized\s*\}/);
  assert.match(lexicon, /findRelatedPhraseEntries/);
  assert.match(lexicon, /kind:\s*\{\s*in:\s*\["collocation",\s*"phrase",\s*"idiom"\]\s*\}/);
  assert.match(lexicon, /tokenPattern/);
});

test("LEX-001 Phase 4 lookup route backfills external results asynchronously", async () => {
  const route = await readText("src/app/api/vocab/lookup/route.ts");

  assert.match(route, /scheduleLexiconBackfill/);
  assert.match(route, /upsertLexiconEntry/);
  assert.match(route, /setTimeout/);
  assert.match(route, /sources:\s*\["external-lookup"\]/);
});
