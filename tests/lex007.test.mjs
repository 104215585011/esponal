// Timestamp: 2026-06-03 13:00
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const readText = (path) => readFile(path, "utf8");

// --- Pure quality-gate scoring (behavioral) ---

test("LEX-007 scoreLexiconEntry sends all-signal clean entry to candidate", async () => {
  const { scoreLexiconEntry } = await import("../src/lib/lexicon-quality.ts");
  const result = scoreLexiconEntry({
    lemmaInDict: true,
    morphologyResolved: true,
    hasRealExample: true,
    meaningsClean: true,
    hasPartOfSpeech: true,
    degraded: false
  });
  assert.equal(result.score, 100);
  assert.equal(result.status, "candidate");
});

test("LEX-007 scoreLexiconEntry sends weak entry to review", async () => {
  const { scoreLexiconEntry } = await import("../src/lib/lexicon-quality.ts");
  const result = scoreLexiconEntry({
    lemmaInDict: false,
    morphologyResolved: false,
    hasRealExample: true,
    meaningsClean: true,
    hasPartOfSpeech: true,
    degraded: false
  });
  assert.equal(result.score, 50);
  assert.equal(result.status, "review");
});

test("LEX-007 scoreLexiconEntry treats 60 as the candidate threshold", async () => {
  const { scoreLexiconEntry } = await import("../src/lib/lexicon-quality.ts");
  const atThreshold = scoreLexiconEntry({
    lemmaInDict: true,
    morphologyResolved: true,
    hasRealExample: false,
    meaningsClean: false,
    hasPartOfSpeech: true,
    degraded: false
  });
  assert.equal(atThreshold.score, 60);
  assert.equal(atThreshold.status, "candidate");
});

test("LEX-007 scoreLexiconEntry forces review when degraded regardless of score", async () => {
  const { scoreLexiconEntry } = await import("../src/lib/lexicon-quality.ts");
  const result = scoreLexiconEntry({
    lemmaInDict: true,
    morphologyResolved: true,
    hasRealExample: true,
    meaningsClean: true,
    hasPartOfSpeech: true,
    degraded: true
  });
  assert.equal(result.status, "review");
});

// --- Signal derivation from a dictionary entry (behavioral) ---

test("LEX-007 deriveScoreSignals reads clean signals from a dictionary entry", async () => {
  const { deriveScoreSignals } = await import("../src/lib/lexicon-quality.ts");
  const signals = deriveScoreSignals(
    {
      word: "libro",
      lemma: "libro",
      partOfSpeech: "n.m.",
      meanings: ["书"],
      examples: [{ es: "Leo un libro.", zh: "我读一本书。" }],
      phonetic: null,
      morphInfo: null,
      nounForms: { singular: "libro", plural: "libros", gender: "m" }
    },
    true
  );
  assert.equal(signals.lemmaInDict, true);
  assert.equal(signals.morphologyResolved, true);
  assert.equal(signals.hasRealExample, true);
  assert.equal(signals.meaningsClean, true);
  assert.equal(signals.hasPartOfSpeech, true);
  assert.equal(signals.degraded, false);
});

test("LEX-007 deriveScoreSignals flags placeholder meanings and degraded entries", async () => {
  const { deriveScoreSignals } = await import("../src/lib/lexicon-quality.ts");
  const signals = deriveScoreSignals(
    {
      word: "xyz",
      lemma: "xyz",
      partOfSpeech: null,
      meanings: ["?"],
      examples: [],
      phonetic: null,
      morphInfo: null,
      degraded: true
    },
    false
  );
  assert.equal(signals.lemmaInDict, false);
  assert.equal(signals.morphologyResolved, false);
  assert.equal(signals.hasRealExample, false);
  assert.equal(signals.meaningsClean, false);
  assert.equal(signals.hasPartOfSpeech, false);
  assert.equal(signals.degraded, true);
});

// --- Data model: status layering (source contract) ---

test("LEX-007 adds LexiconStatus enum and status column with vault default", async () => {
  const schema = await readText("prisma/schema.prisma");
  assert.match(schema, /enum\s+LexiconStatus\s*\{[\s\S]*vault[\s\S]*candidate[\s\S]*review[\s\S]*rejected[\s\S]*\}/);
  assert.match(schema, /status\s+LexiconStatus\s+@default\(vault\)/);
  assert.match(schema, /model\s+LexiconEntry[\s\S]*@@index\(\[status\]\)/);
});

test("LEX-007 migration adds status and backfills external-lookup rows to candidate", async () => {
  const dir = "prisma/migrations/20260603130000_add_lexicon_status";
  assert.equal(existsSync(`${dir}/migration.sql`), true);
  const sql = await readText(`${dir}/migration.sql`);
  assert.match(sql, /CREATE TYPE "LexiconStatus"/);
  assert.match(sql, /ALTER TABLE "LexiconEntry" ADD COLUMN "status"/);
  assert.match(sql, /UPDATE "LexiconEntry"[\s\S]*'candidate'[\s\S]*external-lookup/);
});

// --- Read priority + guard + review queue (source contract) ---

test("LEX-007 lookup read only serves vault and candidate, with review queue and write guard", async () => {
  const lexicon = await readText("src/lib/lexicon.ts");
  assert.match(lexicon, /findLexiconLookupEntry[\s\S]*status:\s*\{\s*in:\s*\[\s*"vault",\s*"candidate"\s*\]/);
  assert.match(lexicon, /export async function listReviewQueue/);
  assert.match(lexicon, /status:\s*"review"[\s\S]*orderBy:\s*\{\s*lookupCount:\s*"desc"/);
  // upsert must never overwrite a vault or human-rejected entry from auto backfill
  assert.match(lexicon, /"vault"[\s\S]*"rejected"|"rejected"[\s\S]*"vault"/);
  assert.match(lexicon, /incrementLookupCount/);
});

test("LEX-007 backfill is confidence-aware and feeds status into the lexicon", async () => {
  const route = await readText("src/app/api/vocab/lookup/route.ts");
  assert.match(route, /scoreLexiconEntry|deriveScoreSignals/);
  assert.match(route, /status/);
});
