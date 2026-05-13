import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("Prisma schema defines vocabulary words owned by users", async () => {
  const schema = await readText("prisma/schema.prisma");

  assert.match(schema, /enum\s+WordStatus\s*{[\s\S]*NEW[\s\S]*LEARNING[\s\S]*KNOWN[\s\S]*}/);
  assert.match(schema, /model\s+Word\s*{[\s\S]*userId\s+String[\s\S]*lemma\s+String[\s\S]*translation\s+String[\s\S]*forms\s+String\[\][\s\S]*status\s+WordStatus\s+@default\(NEW\)[\s\S]*}/);
  assert.match(schema, /model\s+Word\s*{[\s\S]*user\s+User\s+@relation\(fields:\s*\[userId\],\s*references:\s*\[id\],\s*onDelete:\s*Cascade\)[\s\S]*}/);
  assert.match(schema, /@@unique\(\[userId,\s*lemma\]\)/);
  assert.match(schema, /@@index\(\[userId\]\)/);
});

test("Prisma schema defines word encounters linked to words", async () => {
  const schema = await readText("prisma/schema.prisma");

  assert.match(schema, /model\s+WordEncounter\s*{[\s\S]*wordId\s+String[\s\S]*sourceUrl\s+String[\s\S]*timestampSec\s+Int[\s\S]*originalSentence\s+String[\s\S]*translatedSentence\s+String[\s\S]*}/);
  assert.match(schema, /model\s+WordEncounter\s*{[\s\S]*word\s+Word\s+@relation\(fields:\s*\[wordId\],\s*references:\s*\[id\],\s*onDelete:\s*Cascade\)[\s\S]*}/);
  assert.match(schema, /@@index\(\[wordId\]\)/);
});

test("vocab library exposes the ticket CRUD functions", async () => {
  assert.ok(existsSync("src/lib/vocab.ts"), "src/lib/vocab.ts should exist");

  const source = await readText("src/lib/vocab.ts");
  assert.match(source, /export\s+async\s+function\s+createWord/);
  assert.match(source, /export\s+async\s+function\s+addEncounter/);
  assert.match(source, /export\s+async\s+function\s+getWordsByUser/);
  assert.match(source, /export\s+async\s+function\s+getWordWithEncounters/);
  assert.match(source, /prisma\.word\.upsert/);
  assert.match(source, /prisma\.wordEncounter\.create/);
  assert.match(source, /include:\s*{\s*encounters:\s*{/);
});
