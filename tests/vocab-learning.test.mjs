// Timestamp: 2026-11-18 16:30
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildContextCloze,
  buildNounArticleCue,
  detectSpanishCognateHint,
  isLowFrequencyWordCandidate,
  scoreNewReviewPriority
} from "../src/lib/vocab-learning.ts";

test("detectSpanishCognateHint identifies cognate rules and guards false friends", () => {
  const cion = detectSpanishCognateHint("información");
  assert.ok(cion?.isCognate);
  assert.equal(cion?.englishWord, "information");
  assert.match(cion?.patternLabel ?? "", /-ción/);

  const dad = detectSpanishCognateHint("universidad");
  assert.ok(dad?.isCognate);
  assert.equal(dad?.englishWord, "university");

  const prob = detectSpanishCognateHint("problema");
  assert.ok(prob?.isCognate);
  assert.match(prob?.tipZh ?? "", /el problema/);

  const ff = detectSpanishCognateHint("embarazada");
  assert.equal(ff?.isCognate, false);
  assert.equal(ff?.isFalseFriend, true);
  assert.match(ff?.tipZh ?? "", /假朋友/);

  const coreVerb = detectSpanishCognateHint("quedar");
  assert.equal(coreVerb, null);
});

test("buildNounArticleCue enforces gender article binding including exceptions", () => {
  const prob = buildNounArticleCue({
    lemma: "problema",
    partOfSpeech: "noun_m",
    language: "es"
  });
  assert.ok(prob);
  assert.equal(prob.article, "el");
  assert.equal(prob.singularWithArticle, "el problema");
  assert.equal(prob.maskedWithArticle, "____ problema");

  const mano = buildNounArticleCue({
    lemma: "mano",
    partOfSpeech: "noun",
    language: "es"
  });
  assert.ok(mano);
  assert.equal(mano.article, "la");
  assert.equal(mano.singularWithArticle, "la mano");

  const de = buildNounArticleCue({
    lemma: "Fahrrad",
    partOfSpeech: "noun",
    dictData: { nounForms: { singular: "das Fahrrad", plural: "die Fahrräder", gender: "n" } },
    language: "de"
  });
  assert.ok(de);
  assert.equal(de.article, "das");
  assert.equal(de.maskedWithArticle, "____ Fahrrad");
});

test("buildContextCloze extracts encountered conjugated form in real sentence", () => {
  const cloze = buildContextCloze({
    sentence: "Ayer fui al mercado con mi madre.",
    translatedSentence: "昨天我和妈妈去了市场。",
    lemma: "ir",
    forms: ["fui", "ir", "voy"]
  });
  assert.ok(cloze);
  assert.equal(cloze.answerForm, "fui");
  assert.equal(cloze.maskedSentence, "Ayer ______ al mercado con mi madre.");

  const phraseCloze = buildContextCloze({
    sentence: "Tienes que estudiar más si quieres aprobar.",
    translatedSentence: "如果你想及格就得多学习。",
    lemma: "tener que",
    forms: ["tienes que", "tener que"]
  });
  assert.ok(phraseCloze);
  assert.equal(phraseCloze.answerForm, "Tienes que");
  assert.equal(phraseCloze.maskedSentence, "______ estudiar más si quieres aprobar.");
});

test("scoreNewReviewPriority puts repeated encounters & core frequency ahead of obscure single lookups", () => {
  const now = Date.now();
  const rare = scoreNewReviewPriority({
    itemType: "word",
    encounterCount: 1,
    lexiconLevel: "C1",
    lexiconFrequency: 7000,
    createdAtMs: now - 5 * 86400000
  });
  const frequent = scoreNewReviewPriority({
    itemType: "word",
    encounterCount: 3,
    lexiconLevel: "A1",
    lexiconFrequency: 180,
    createdAtMs: now - 1 * 86400000
  });
  const chunk = scoreNewReviewPriority({
    itemType: "phrase",
    encounterCount: 1,
    createdAtMs: now
  });

  assert.ok(frequent.score > chunk.score);
  assert.ok(chunk.score > rare.score);
  assert.match(frequent.priorityReason ?? "", /遇到 3 次/);
  assert.equal(
    isLowFrequencyWordCandidate({
      encounterCount: 1,
      lexiconLevel: "C1",
      lexiconFrequency: 7000,
      srsLapses: 2
    }),
    true
  );
});
