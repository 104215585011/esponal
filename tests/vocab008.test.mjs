import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const readText = (filePath) => readFile(filePath, "utf8");

test("VOCAB-008 createWord stores verb conjugation forms", async () => {
  const source = await readText("src/lib/vocab.ts");

  assert.match(source, /tryConjugateVerb/);
  assert.match(source, /isVerbPos/);
  assert.match(source, /Object\.values\(conjugations\)/);
  assert.match(source, /normalizedVerbForms/);
  assert.match(source, /forms\.map\(\(form\) => form\.trim\(\)\.toLowerCase\(\)\)/);
});

test("VOCAB-008 backfill script and npm command exist", async () => {
  const pkg = JSON.parse(await readText("package.json"));

  assert.ok(existsSync("scripts/backfill-verb-forms.mjs"));
  assert.equal(pkg.scripts["backfill:verb-forms"], "node scripts/backfill-verb-forms.mjs");

  const script = await readText("scripts/backfill-verb-forms.mjs");
  assert.match(script, /tryConjugateVerb/);
  assert.match(script, /findMany/);
  assert.match(script, /update/);
  assert.match(script, /Backfilled verb forms/);
});

test("VOCAB-008 highlight GET returns savedForms for the current user", async () => {
  const route = await readText("src/app/api/vocab/highlight/route.ts");

  assert.match(route, /export async function GET/);
  assert.match(route, /savedForms/);
  assert.match(route, /forms:\s*true/);
  assert.match(route, /lemma:\s*true/);
  assert.match(route, /Cache-Control/);
  assert.match(route, /savedForms:\s*\[\]/);
});

test("VOCAB-008 Lectura reader fetches saved forms and marks saved words", async () => {
  const reader = await readText("src/app/lectura/LecturaReader.tsx");

  assert.match(reader, /\/api\/vocab\/highlight/);
  assert.match(reader, /savedSet/);
  assert.match(reader, /saved-word/);
  assert.match(reader, /savedSet\.has\(normalized\)/);
  assert.match(reader, /openLookup/);
});

test("VOCAB-008 course lookup text fetches saved forms and preserves lookup", async () => {
  const courseLookup = await readText("src/app/learn/[slug]/CourseLookupText.tsx");

  assert.match(courseLookup, /\/api\/vocab\/highlight/);
  assert.match(courseLookup, /savedSet/);
  assert.match(courseLookup, /saved-word/);
  assert.match(courseLookup, /setActiveWord/);
  assert.match(courseLookup, /LookupCard/);
});

test("VOCAB-008 saved-word style is a deep gray underline", async () => {
  const css = await readText("src/app/globals.css");

  assert.match(css, /\.saved-word/);
  assert.match(css, /text-decoration:\s*underline/);
  assert.match(css, /text-decoration-color:\s*#4b5563/);
  assert.match(css, /text-decoration-thickness:\s*1\.5px/);
  assert.match(css, /text-underline-offset:\s*3px/);
});
