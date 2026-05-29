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

test("LEX-CLEANUP-001 cleanup script is safe by default and migrates single-token phrase kinds", async () => {
  const scriptPath = "scripts/lexicon/cleanup-single-token-phrases.mjs";
  assert.equal(existsSync(scriptPath), true);

  const script = await readText(scriptPath);
  assert.match(script, /--help/);
  assert.match(script, /--write/);
  assert.match(script, /dryRun\s*=\s*!args\.has\("--write"\)/);
  assert.match(script, /kind:\s*\{\s*in:\s*\["collocation",\s*"phrase",\s*"idiom"\]\s*\}/);
  assert.match(script, /NOT LIKE '% %'/);
  assert.match(script, /kind:\s*"construction"/);
  assert.match(script, /updated/);
});

test("LEX-CLEANUP-001 lookup treats construction as a local lookup kind with prominent usage", async () => {
  const route = await readText("src/app/api/vocab/lookup/route.ts");
  const lib = await readText("src/lib/lexicon.ts");

  assert.match(lib, /"construction"/);
  assert.match(route, /usageNote/);
  assert.match(route, /entry\.kind === "construction"/);
  assert.match(route, /morphInfo:\s*entry\.explanationZh/);
});
