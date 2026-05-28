// Timestamp: 2026-05-28 11:25
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const readText = (path) => readFile(path, "utf8");
const migrationPath = "prisma/migrations/20260528112500_add_lexicon_entry/migration.sql";

test("LEX-001 Phase 1 adds LexiconEntry schema and enums", async () => {
  const schema = await readText("prisma/schema.prisma");

  assert.match(schema, /model LexiconEntry\s*\{/);
  assert.match(schema, /enum LexiconKind\s*\{[\s\S]*word[\s\S]*phrase[\s\S]*collocation[\s\S]*idiom[\s\S]*\}/);
  assert.match(schema, /enum CefrLevel\s*\{[\s\S]*A1[\s\S]*A2[\s\S]*B1[\s\S]*B2[\s\S]*C1[\s\S]*C2[\s\S]*\}/);
  assert.match(schema, /kind\s+LexiconKind/);
  assert.match(schema, /lemma\s+String/);
  assert.match(schema, /displayForm\s+String/);
  assert.match(schema, /forms\s+String\[\]/);
  assert.match(schema, /partOfSpeech\s+String\?/);
  assert.match(schema, /level\s+CefrLevel\?/);
  assert.match(schema, /frequency\s+Int\?/);
  assert.match(schema, /examples\s+Json\?/);
  assert.match(schema, /morphology\s+Json\?/);
  assert.match(schema, /collocations\s+String\[\]/);
  assert.match(schema, /sources\s+String\[\]/);
  assert.match(schema, /licenseCode\s+String/);
  assert.match(schema, /qualityScore\s+Int\s+@default\(0\)/);
  assert.match(schema, /lookupCount\s+Int\s+@default\(0\)/);
  assert.match(schema, /@@unique\(\[kind,\s*lemma\]\)/);
  assert.match(schema, /@@index\(\[level\]\)/);
  assert.match(schema, /@@index\(\[frequency\]\)/);
  assert.match(schema, /@@index\(\[lookupCount\]\)/);
});

test("LEX-001 Phase 1 includes a migration for lexicon_entries", async () => {
  assert.ok(existsSync(migrationPath), `${migrationPath} should exist`);
  const migration = await readText(migrationPath);

  assert.match(migration, /CREATE TYPE "LexiconKind"/);
  assert.match(migration, /'word'[\s\S]*'phrase'[\s\S]*'collocation'[\s\S]*'idiom'/);
  assert.match(migration, /CREATE TYPE "CefrLevel"/);
  assert.match(migration, /CREATE TABLE "LexiconEntry"/);
  assert.match(migration, /"forms" TEXT\[\]/);
  assert.match(migration, /"collocations" TEXT\[\]/);
  assert.match(migration, /"sources" TEXT\[\]/);
  assert.match(migration, /"qualityScore" INTEGER NOT NULL DEFAULT 0/);
  assert.match(migration, /"lookupCount" INTEGER NOT NULL DEFAULT 0/);
  assert.match(migration, /CREATE UNIQUE INDEX "LexiconEntry_kind_lemma_key"/);
});

test("LEX-001 Phase 1 exposes lexicon helper functions", async () => {
  const libPath = "src/lib/lexicon.ts";
  assert.ok(existsSync(libPath), `${libPath} should exist`);

  const lib = await readText(libPath);
  assert.match(lib, /export type LexiconUpsertInput/);
  assert.match(lib, /export async function getLexiconEntry/);
  assert.match(lib, /export async function upsertLexiconEntry/);
  assert.match(lib, /export async function incrementLookupCount/);
  assert.match(lib, /prisma\.lexiconEntry\.findFirst/);
  assert.match(lib, /OR:\s*\[/);
  assert.match(lib, /forms:\s*\{\s*has:/);
  assert.match(lib, /kind:\s*kind\s*\?\?/);
  assert.match(lib, /prisma\.lexiconEntry\.upsert/);
  assert.match(lib, /where:\s*\{\s*kind_lemma:/);
  assert.match(lib, /const lemma\s*=\s*normalizeLexiconText\(input\.lemma\)/);
  assert.match(lib, /create:\s*\{[\s\S]*lemma,/);
  assert.match(lib, /const displayForm\s*=\s*input\.displayForm\s*\?\?/);
  assert.match(lib, /create:\s*\{[\s\S]*displayForm,/);
  assert.match(lib, /const forms\s*=\s*normalizeForms/);
  assert.match(lib, /create:\s*\{[\s\S]*forms,/);
  assert.match(lib, /licenseCode:\s*input\.licenseCode/);
  assert.match(lib, /prisma\.lexiconEntry\.update/);
  assert.match(lib, /lookupCount:\s*\{\s*increment:\s*1\s*\}/);
});
