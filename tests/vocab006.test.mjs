import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const readText = (filePath) => readFile(filePath, "utf8");

test("VOCAB-006 adds ts-fsrs dependency and SRS fields to Word", async () => {
  const pkg = JSON.parse(await readText("package.json"));
  const schema = await readText("prisma/schema.prisma");
  const migrations = readdirSync("prisma/migrations");

  assert.equal(typeof pkg.dependencies["ts-fsrs"], "string");
  assert.ok(
    migrations.some((name) => name.includes("add_srs_fields")),
    "migration directory should include add_srs_fields"
  );
  assert.match(schema, /srsState\s+String\?/);
  assert.match(schema, /srsDue\s+DateTime\?/);
  assert.match(schema, /srsStability\s+Float\?/);
  assert.match(schema, /srsDifficulty\s+Float\?/);
  assert.match(schema, /srsElapsedDays\s+Int\?/);
  assert.match(schema, /srsScheduledDays\s+Int\?/);
  assert.match(schema, /srsReps\s+Int\s+@default\(0\)/);
  assert.match(schema, /srsLapses\s+Int\s+@default\(0\)/);
  assert.match(schema, /srsLastReview\s+DateTime\?/);
  assert.match(schema, /@@index\(\[userId,\s*srsDue\]\)/);
});

test("VOCAB-006 exposes SRS helper functions", async () => {
  assert.ok(existsSync("src/lib/srs.ts"));

  const mod = await import("../src/lib/srs.ts");

  assert.equal(typeof mod.fsrs, "object");
  assert.equal(typeof mod.initCard, "function");
  assert.equal(typeof mod.scheduleCard, "function");

  const card = mod.initCard(new Date("2026-05-20T00:00:00Z"));
  assert.equal(card.srsReps, 0);

  const scheduled = mod.scheduleCard(card, "Good", new Date("2026-05-20T00:00:00Z"));
  assert.ok(scheduled.srsDue instanceof Date);
  assert.equal(typeof scheduled.srsState, "string");
  assert.ok(scheduled.srsReps > 0);
});

test("VOCAB-006 review API routes exist and enforce auth/rating contracts", async () => {
  const getRoutePath = "src/app/api/vocab/review/route.ts";
  const postRoutePath = "src/app/api/vocab/review/[wordId]/route.ts";
  assert.ok(existsSync(getRoutePath), `${getRoutePath} should exist`);
  assert.ok(existsSync(postRoutePath), `${postRoutePath} should exist`);

  const getRoute = await readText(getRoutePath);
  const postRoute = await readText(postRoutePath);

  assert.match(getRoute, /export async function GET/);
  assert.match(getRoute, /getServerSession/);
  assert.match(getRoute, /status:\s*401/);
  assert.match(getRoute, /srsDue/);
  assert.match(getRoute, /take:\s*20/);
  assert.match(getRoute, /totalDue/);
  assert.match(getRoute, /dueWords/);

  assert.match(postRoute, /export async function POST/);
  assert.match(postRoute, /getServerSession/);
  assert.match(postRoute, /status:\s*401/);
  assert.match(postRoute, /Again|Hard|Good|Easy/);
  assert.match(postRoute, /scheduleCard/);
  assert.match(postRoute, /nextDue/);
});

test("VOCAB-006 review page renders flashcard flow with TTS and rating buttons", async () => {
  const pagePath = "src/app/vocab/review/page.tsx";
  const clientPath = "src/app/vocab/review/ReviewClient.tsx";
  assert.ok(existsSync(pagePath), `${pagePath} should exist`);
  assert.ok(existsSync(clientPath), `${clientPath} should exist`);

  const page = await readText(pagePath);
  const client = await readText(clientPath);

  assert.match(page, /SiteHeader/);
  assert.match(page, /ReviewClient/);
  assert.match(page, /\/api\/auth\/signin/);
  assert.match(client, /"use client"/);
  assert.match(client, /\/api\/vocab\/review/);
  assert.match(client, /speak\(/);
  assert.match(client, /showBack/);
  assert.match(client, /Again/);
  assert.match(client, /Hard/);
  assert.match(client, /Good/);
  assert.match(client, /Easy/);
  assert.match(client, /完成/);
});

test("VOCAB-006 vocab page shows due review badge only when words are due", async () => {
  const page = await readText("src/app/vocab/page.tsx");

  assert.match(page, /getDueReviewCount/);
  assert.match(page, /\/vocab\/review/);
  assert.match(page, /待复习/);
});
