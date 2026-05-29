import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

const readText = (path) => readFile(path, "utf8");

test("LEX-CLEANUP-001 adds construction to LexiconKind and migration SQL", async () => {
  const schema = await readText("prisma/schema.prisma");
  assert.match(schema, /enum LexiconKind\s*\{[\s\S]*construction[\s\S]*\}/);

  const migrationPath = "prisma/migrations/20260529183000_add_lexicon_construction/migration.sql";
  assert.equal(existsSync(migrationPath), true);
  const migration = await readText(migrationPath);
  assert.match(migration, /ALTER TYPE "LexiconKind" ADD VALUE 'construction'/);
});

test("LEX-CLEANUP-001 reviewed CSV locks the PM decision counts and special construction lemmas", async () => {
  const csvPath = "data/lexicon-cleanup-001.reviewed.csv";
  assert.equal(existsSync(csvPath), true);

  const rows = (await readText(csvPath))
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => {
      const [lemma, current_kind, has_word_dup, decision, ...usage_note_zh] = line.split(",");
      return {
        lemma,
        current_kind,
        has_word_dup,
        decision,
        usage_note_zh: usage_note_zh.join(",")
      };
    });

  const counts = new Map();
  for (const row of rows) {
    counts.set(row.decision, (counts.get(row.decision) ?? 0) + 1);
  }

  assert.equal(rows.length, 135);
  assert.equal(counts.get("construction"), 10);
  assert.equal(counts.get("delete-dup"), 60);
  assert.equal(counts.get("migrate-word"), 61);
  assert.equal(counts.get("delete"), 4);

  const constructionLemmas = rows
    .filter((row) => row.decision === "construction")
    .map((row) => row.lemma)
    .sort();
  assert.deepEqual(constructionLemmas, [
    "doler",
    "encantar",
    "faltar",
    "gustar",
    "importar",
    "interesar",
    "parecer",
    "quedar",
    "sobrar",
    "soler"
  ]);
});

test("LEX-CLEANUP-001 cleanup script is safe by default and follows reviewed CSV decisions", async () => {
  const scriptPath = "scripts/lexicon/cleanup-single-token-phrases.mjs";
  assert.equal(existsSync(scriptPath), true);

  const script = await readText(scriptPath);
  assert.match(script, /--help/);
  assert.match(script, /--write/);
  assert.match(script, /dryRun\s*=\s*!args\.has\("--write"\)/);
  assert.match(script, /lexicon-cleanup-001\.reviewed\.csv/);
  assert.match(script, /delete-dup/);
  assert.match(script, /migrate-word/);
  assert.match(script, /construction/);
  assert.match(script, /usage_note_zh/);
  assert.match(script, /\$transaction/);
  assert.match(script, /kind:\s*"word"/);
  assert.match(script, /explanationZh/);
  assert.match(script, /remaining_single_token_phrase_kind/);
  assert.match(script, /construction_with_usage/);
  assert.match(script, /kind='construction'/);
});

test("LEX-CLEANUP-001 lookup treats construction as a local lookup kind with prominent usage", async () => {
  const route = await readText("src/app/api/vocab/lookup/route.ts");
  const lib = await readText("src/lib/lexicon.ts");

  assert.match(lib, /"construction"/);
  assert.match(route, /usageNote/);
  assert.match(route, /entry\.kind === "construction"/);
  assert.match(route, /morphInfo:\s*entry\.explanationZh/);
});
