// Timestamp: 2026-05-28 19:12
import assert from "node:assert/strict";
import test from "node:test";

test("LEX-001 pos cleanup planner maps dirty rows and reports unknown rows", async () => {
  const { planLexiconPosNormalization } = await import("../scripts/lexicon/normalize-lexicon-pos.mjs");

  const plan = planLexiconPosNormalization([
    { id: "1", lemma: "rapido", partOfSpeech: "adjective/adverb" },
    { id: "2", lemma: "mi", partOfSpeech: "determinante posesivo" },
    { id: "3", lemma: "casa", partOfSpeech: "noun_f" },
    { id: "4", lemma: "raro", partOfSpeech: "palabra rara" }
  ]);

  assert.deepEqual(plan.updates, [
    { id: "1", lemma: "rapido", from: "adjective/adverb", to: "adj" },
    { id: "2", lemma: "mi", from: "determinante posesivo", to: "determiner" }
  ]);
  assert.deepEqual(plan.unknown, [
    { id: "4", lemma: "raro", partOfSpeech: "palabra rara" }
  ]);
  assert.equal(plan.valid, 1);
});

