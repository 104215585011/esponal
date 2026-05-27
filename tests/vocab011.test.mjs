import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const readText = (path) => readFile(path, "utf8");

test("VOCAB-011 exposes an auth-protected vocab stats route with the reviewed response shape", async () => {
  const routePath = "src/app/api/vocab/stats/route.ts";
  assert.ok(existsSync(routePath), `${routePath} should exist`);

  const route = await readText(routePath);

  assert.match(route, /getServerSession/);
  assert.match(route, /getAuthOptions/);
  assert.match(route, /status:\s*401/);
  assert.match(route, /totalSaved/);
  assert.match(route, /encounterBuckets/);
  assert.match(route, /weeklyNew/);
  assert.match(route, /bySource/);
});

test("VOCAB-011 adds a shared getVocabStats helper with encounter buckets and source distribution", async () => {
  const libPath = "src/lib/vocab.ts";
  assert.ok(existsSync(libPath), `${libPath} should exist`);

  const source = await readText(libPath);

  assert.match(source, /export async function getVocabStats/);
  assert.match(source, /groupBy/);
  assert.match(source, /"1 次"|1 娆?/);
  assert.match(source, /"2 次"|2 娆?/);
  assert.match(source, /"3-5 次"|3鈥? 娆?/);
  assert.match(source, /"6\+ 次"|6\+ 娆?/);
  assert.match(source, /lectura|video|talk|course/);
});

test("VOCAB-011 vocab page loads stats server-side and mounts a dashboard above the accordion", async () => {
  const pagePath = "src/app/vocab/page.tsx";
  assert.ok(existsSync(pagePath), `${pagePath} should exist`);

  const page = await readText(pagePath);

  assert.match(page, /getVocabStats/);
  assert.match(page, /Promise\.all/);
  assert.match(page, /<VocabDashboard stats=\{stats\} \/>/);
  assert.match(page, /border-b border-gray-100 mb-6 pb-6/);
});

test("VOCAB-011 dashboard uses reviewed compact cards, bar rows, and text source separators", async () => {
  const dashboardPath = "src/app/vocab/VocabDashboard.tsx";
  assert.ok(existsSync(dashboardPath), `${dashboardPath} should exist`);

  const dashboard = await readText(dashboardPath);

  assert.match(dashboard, /rounded-/);
  assert.match(dashboard, /text-2xl/);
  assert.match(dashboard, /h-1\.5/);
  assert.match(dashboard, /bg-brand-500/);
  assert.match(dashboard, /·/);
  assert.doesNotMatch(dashboard, /路/);
});
