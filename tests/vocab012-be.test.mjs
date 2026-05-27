// Timestamp: 2026-05-27 15:02
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const routePath = "src/app/api/vocab/encounter/route.ts";
const readText = (path) => readFile(path, "utf8");

test("VOCAB-012-BE exposes a protected encounter recording endpoint", async () => {
  assert.ok(existsSync(routePath), `${routePath} should exist`);

  const route = await readText(routePath);

  assert.match(route, /export async function POST/);
  assert.match(route, /getServerSession/);
  assert.match(route, /getAuthOptions/);
  assert.match(route, /status:\s*401/);
  assert.match(route, /checkRateLimit[\s\S]*addLimiter|addLimiter[\s\S]*checkRateLimit/);
  assert.match(route, /status:\s*429/);
  assert.match(route, /Retry-After/);
});

test("VOCAB-012-BE validates required encounter fields and source type", async () => {
  const route = await readText(routePath);

  assert.match(route, /wordId/);
  assert.match(route, /sourceType/);
  assert.match(route, /sourceUrl/);
  assert.match(route, /originalSentence/);
  assert.match(route, /missing required fields/);
  assert.match(route, /invalid sourceType/);
  assert.match(route, /status:\s*400/);
  assert.match(route, /"video"[\s\S]*"course"[\s\S]*"lectura"[\s\S]*"dissect"[\s\S]*"grammar"[\s\S]*"talk"/);
});

test("VOCAB-012-BE records encounters only for the signed-in user's word", async () => {
  const route = await readText(routePath);

  assert.match(route, /prisma\.word\.findFirst/);
  assert.match(route, /id:\s*wordId/);
  assert.match(route, /userId:\s*session\.user\.id/);
  assert.match(route, /status:\s*404/);
  assert.match(route, /prisma\.wordEncounter\.create/);
  assert.match(route, /sourceUrl/);
  assert.match(route, /timestampSec/);
  assert.match(route, /courseRef/);
  assert.match(route, /originalSentence/);
  assert.match(route, /translatedSentence/);
  assert.match(route, /totalEncounters/);
  assert.match(route, /encounterId/);
});
