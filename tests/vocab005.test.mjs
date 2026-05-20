import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const readText = (filePath) => readFile(filePath, "utf8");

test("VOCAB-005 adds spanish-verbs and exposes tryConjugateVerb", async () => {
  const pkg = JSON.parse(await readText("package.json"));

  assert.equal(typeof pkg.dependencies["spanish-verbs"], "string");
  assert.ok(existsSync("src/lib/conjugate.ts"));

  const mod = await import("../src/lib/conjugate.ts");

  assert.equal(typeof mod.tryConjugateVerb, "function");
});

test("VOCAB-005 conjugates regular and irregular verbs deterministically", async () => {
  const { tryConjugateVerb } = await import("../src/lib/conjugate.ts");

  const vivir = tryConjugateVerb("vivir");
  assert.ok(vivir);
  assert.equal(vivir.presente.yo, "vivo");
  assert.equal(vivir.presente.nosotros, "vivimos");

  const ser = tryConjugateVerb("ser");
  assert.ok(ser);
  assert.equal(ser.presente.yo, "soy");
  assert.equal(ser.preteritoIndefinido.yo, "fui");

  assert.equal(tryConjugateVerb("xyzfake123"), null);
});

test("VOCAB-005 upgrades dictionary pipeline and save payload for richer forms", async () => {
  const dictionary = await readText("src/lib/dictionary.ts");
  const lookupCard = await readText("src/app/watch/LookupCard.tsx");
  const vocabPage = await readText("src/app/vocab/page.tsx");

  assert.match(dictionary, /vocab:dict:v3:/);
  assert.match(dictionary, /tryConjugateVerb\((aiLemma|hintLemma)\)/);
  assert.match(dictionary, /nounForms/);
  assert.match(dictionary, /adjectiveForms/);
  assert.match(lookupCard, /conjugations/);
  assert.match(lookupCard, /nounForms/);
  assert.match(lookupCard, /adjectiveForms/);
  assert.match(vocabPage, /conjugations/);
  assert.match(vocabPage, /nounForms/);
  assert.match(vocabPage, /adjectiveForms/);
});

test("VOCAB-005 adds conjugation and forms UI on vocab page only", async () => {
  assert.ok(existsSync("src/app/components/vocab/ConjugationTable.tsx"));

  const table = await readText("src/app/components/vocab/ConjugationTable.tsx");
  const accordion = await readText("src/app/components/vocab/VocabAccordion.tsx");
  const lookupCard = await readText("src/app/watch/LookupCard.tsx");

  assert.match(table, /presente/);
  assert.match(table, /preteritoIndefinido/);
  assert.match(table, /preteritoImperfecto/);
  assert.match(table, /futuro/);
  assert.match(table, /condicional/);
  assert.match(table, /presenteSubjuntivo/);
  assert.match(table, /imperativo/);
  assert.match(accordion, /ConjugationTable/);
  assert.match(accordion, /nounForms/);
  assert.match(accordion, /adjectiveForms/);
  assert.doesNotMatch(lookupCard, /ConjugationTable/);
});
