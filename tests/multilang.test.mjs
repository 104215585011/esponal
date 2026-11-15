// Timestamp: 2026-11-15 08:15
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readText = (path) => readFileSync(path, "utf8");

test("MULTILANG schema adds language isolation columns and composite unique keys", () => {
  const schema = readText("prisma/schema.prisma");
  const migration = readText("prisma/migrations/20261115080000_add_language_isolation/migration.sql");

  assert.match(schema, /model User[\s\S]*activeLanguage\s+String\s+@default\("es"\)/);
  assert.match(schema, /model Word[\s\S]*language\s+String\s+@default\("es"\)[\s\S]*@@unique\(\[userId,\s*language,\s*lemma\]\)/);
  assert.match(schema, /model SavedPhrase[\s\S]*language\s+String\s+@default\("es"\)[\s\S]*@@unique\(\[userId,\s*language,\s*lemma,\s*kind\]\)/);
  assert.match(schema, /model LexiconEntry[\s\S]*language\s+String\s+@default\("es"\)[\s\S]*@@unique\(\[language,\s*kind,\s*lemma\]\)/);
  assert.match(schema, /model ImportedDocument[\s\S]*language\s+String\s+@default\("es"\)/);
  assert.match(schema, /model VideoView[\s\S]*language\s+String\s+@default\("es"\)/);
  assert.match(schema, /model LecturaRead[\s\S]*language\s+String\s+@default\("es"\)/);

  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS "Word_userId_language_lemma_key"/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS "LexiconEntry_language_kind_lemma_key"/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS "saved_phrases_userId_language_lemma_kind_key"/);
});

test("MULTILANG exposes user language preference route and scoped lookup/vocab APIs", () => {
  const userLangRoute = readText("src/app/api/user/language/route.ts");
  const lookupRoute = readText("src/app/api/vocab/lookup/route.ts");
  const vocabAddRoute = readText("src/app/api/vocab/add/route.ts");

  assert.match(userLangRoute, /export async function GET/);
  assert.match(userLangRoute, /export async function PATCH/);
  assert.match(userLangRoute, /activeLanguage/);

  assert.match(lookupRoute, /resolveRequestLanguage/);
  assert.match(lookupRoute, /detectQueryLanguage/);
  assert.match(lookupRoute, /detectedLanguage/);

  assert.match(vocabAddRoute, /resolveRequestLanguage/);
  assert.match(vocabAddRoute, /createWord\(\{[\s\S]*language,/);
});
