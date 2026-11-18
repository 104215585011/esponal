// Timestamp: 2026-11-18 16:30
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildContextCloze,
  buildNounArticleCue,
  buildQuick5Mix,
  detectSpanishCognateHint,
  isLowFrequencyWordCandidate,
  scoreNewReviewPriority
} from "../src/lib/vocab-learning.ts";
import { SPANISH_STARTER_PACK } from "../src/lib/vocab-starter.ts";

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

test("buildQuick5Mix combines 2 recent + 3 due without duplicates and backfills cleanly", () => {
  const w1 = { id: "1", itemType: "word", lemma: "hay" };
  const w2 = { id: "2", itemType: "word", lemma: "quedar" };
  const w3 = { id: "3", itemType: "word", lemma: "puede" };
  const w4 = { id: "4", itemType: "phrase", lemma: "tiene que" };
  const w5 = { id: "5", itemType: "word", lemma: "llevar" };
  const w6 = { id: "6", itemType: "word", lemma: "decir" };

  // When w2 is in both recent and due, it should appear only once and draw the next due item
  const mixed = buildQuick5Mix({
    recent: [w1, w2, w3],
    due: [w2, w4, w5, w6],
    recentQuota: 2,
    dueQuota: 3,
    totalMax: 5
  });
  assert.equal(mixed.length, 5);
  const ids = mixed.map((item) => item.id);
  assert.equal(new Set(ids).size, 5);
  assert.deepEqual(ids, ["1", "2", "4", "5", "6"]);

  // Backfill when due has fewer than 3
  const recentHeavy = buildQuick5Mix({
    recent: [w1, w2, w3, w4],
    due: [w5],
    recentQuota: 2,
    dueQuota: 3,
    totalMax: 5
  });
  assert.deepEqual(
    recentHeavy.map((i) => i.id),
    ["1", "2", "5", "3", "4"]
  );
});

test("SPANISH_STARTER_PACK covers core high-frequency skeleton words & chunks", () => {
  assert.ok(SPANISH_STARTER_PACK.length >= 20);
  const lemmas = new Set(SPANISH_STARTER_PACK.map((i) => i.lemma));
  assert.ok(lemmas.has("hay"));
  assert.ok(lemmas.has("poder"));
  assert.ok(lemmas.has("tener que"));
  for (const item of SPANISH_STARTER_PACK) {
    assert.ok(item.translationZh && item.exampleEs && item.exampleZh);
  }
});
