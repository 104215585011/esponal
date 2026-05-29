import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { detectPhrasesFromEntries } from "../src/lib/lexicon-phrases.ts";

const entries = [
  { id: "pf", lemma: "por favor", kind: "phrase" },
  { id: "tq", lemma: "tener que", kind: "collocation" },
  { id: "ia", lemma: "ir a", kind: "collocation" },
  { id: "hc", lemma: "hacer la compra", kind: "collocation" },
  { id: "ad", lemma: "acabar de", kind: "collocation" },
  { id: "tg", lemma: "tener ganas de", kind: "collocation" }
];

test("PHRASE-001 detects literal phrase matches with offsets", () => {
  const spans = detectPhrasesFromEntries("Por favor, ven aqui", entries);

  assert.deepEqual(spans.map((span) => span.lemma), ["por favor"]);
  assert.equal(spans[0].surface, "Por favor");
  assert.equal(spans[0].start, 0);
  assert.equal(spans[0].end, 9);
});

test("PHRASE-001 normalizes verb forms for collocation matches", () => {
  const spans = detectPhrasesFromEntries("Tengo que comer", entries);

  assert.deepEqual(spans.map((span) => span.lemma), ["tener que"]);
  assert.equal(spans[0].surface, "Tengo que");
});

test("PHRASE-001 detects multiple non-overlapping phrases in one sentence", () => {
  const spans = detectPhrasesFromEntries("Voy a hacer la compra", entries);

  assert.deepEqual(spans.map((span) => span.lemma), ["ir a", "hacer la compra"]);
});

test("PHRASE-001 detects embedded collocations", () => {
  const spans = detectPhrasesFromEntries("Acabo de tener ganas de salir", entries);

  assert.deepEqual(spans.map((span) => span.lemma), ["acabar de", "tener ganas de"]);
});

test("PHRASE-001 returns an empty array when no phrase matches", () => {
  assert.deepEqual(detectPhrasesFromEntries("Hola mundo", entries), []);
});

test("PHRASE-001 detects nested phrases (greedily prefers longer phrase)", () => {
  const extendedEntries = [
    ...entries,
    { id: "tg_short", lemma: "tener ganas", kind: "collocation" }
  ];
  const spans = detectPhrasesFromEntries("Tengo ganas de salir", extendedEntries);
  assert.deepEqual(spans.map((span) => span.lemma), ["tener ganas de"]);
});

test("PHRASE-001 handles empty or blank cases gracefully", () => {
  assert.deepEqual(detectPhrasesFromEntries("", entries), []);
  assert.deepEqual(detectPhrasesFromEntries("   ", entries), []);
});

test("PHRASE-001 exposes detect-phrases API route with rate limit and latency header", async () => {
  const route = await readFile("src/app/api/lexicon/detect-phrases/route.ts", "utf8");

  assert.match(route, /export async function POST/);
  assert.match(route, /detectPhrasesInText/);
  assert.match(route, /addLimiter/);
  assert.match(route, /X-Phrase-Detect-Latency-Ms/);
});
