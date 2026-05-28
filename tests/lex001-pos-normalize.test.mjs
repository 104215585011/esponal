// Timestamp: 2026-05-28 19:08
import assert from "node:assert/strict";
import test from "node:test";

test("LEX-001 pos normalizer maps DeepSeek Spanish and verbose labels to the whitelist", async () => {
  const { normalizeLexiconPartOfSpeech, ALLOWED_WORD_PARTS_OF_SPEECH } = await import("../scripts/lexicon/pos-normalize.mjs");

  const cases = new Map([
    ["adjective", "adj"],
    ["adverb", "adv"],
    ["adjective/adverb", "adj"],
    ["adjective/noun", "adj"],
    ["determinante", "determiner"],
    ["determinante posesivo", "determiner"],
    ["preposición", "prep"],
    ["conjunción", "conj"],
    ["verbo", "verb"],
    ["sustantivo", "noun_mf"]
  ]);

  for (const [input, expected] of cases) {
    const normalized = normalizeLexiconPartOfSpeech(input);
    assert.equal(normalized, expected, input);
    assert.ok(ALLOWED_WORD_PARTS_OF_SPEECH.has(normalized), `${normalized} must be whitelisted`);
  }
});

test("LEX-001 pos normalizer rejects unknown labels instead of storing raw values", async () => {
  const { normalizeLexiconPartOfSpeech } = await import("../scripts/lexicon/pos-normalize.mjs");

  assert.equal(normalizeLexiconPartOfSpeech("palabra rara"), null);
  assert.equal(normalizeLexiconPartOfSpeech(""), null);
});

