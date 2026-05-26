import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const readText = (path) => readFile(path, "utf8");

test("WEB-010 continue learning data helpers query recent video and course encounters", async () => {
  const helperPath = "src/lib/continueLearning.ts";
  assert.ok(existsSync(helperPath), `${helperPath} should exist`);

  const helper = await readText(helperPath);

  assert.match(helper, /getLastVideoEncounter/);
  assert.match(helper, /getLastCourseEncounter/);
  assert.match(helper, /sourceType:\s*"video"/);
  assert.match(helper, /sourceType:\s*"course"/);
  assert.match(helper, /createdAt:\s*"desc"/);
  assert.match(helper, /word:\s*\{\s*userId/s);
  assert.match(helper, /parseYouTubeVideoId/);
  assert.match(helper, /formatRelativeTime/);
});

test("WEB-010 ContinueLearning component still renders video and course cards with jump links", async () => {
  const componentPath = "src/app/components/web/ContinueLearning.tsx";
  assert.ok(existsSync(componentPath), `${componentPath} should exist`);

  const component = await readText(componentPath);

  assert.match(component, /缁х画瀛︿範|继续学习/);
  assert.match(component, /videoEncounter/);
  assert.match(component, /courseEncounter/);
  assert.match(component, /buildVideoJumpHref/);
  assert.match(component, /buildVideoJumpHref\(`\/watch\?v=\$\{videoEncounter\.videoId\}`/);
  assert.match(component, /\/learn\/\$\{courseEncounter\.slug\}/);
  assert.match(component, /videoEncounter\.thumbnail/);
  assert.match(component, /fallback/);
  assert.match(component, /rounded-hero/);
  assert.match(component, /shadow-card/);
});

test("WEB-010 homepage now uses shared progress data instead of ContinueLearning cards", async () => {
  const page = await readText("src/app/page.tsx");

  assert.match(page, /getVocabStats/);
  assert.match(page, /prisma\.lecturaRead\.count/);
  assert.match(page, /userId/);
  assert.match(page, /learningSteps/);
  assert.match(page, /<HomeHero isLoggedIn=\{!!userId\} \/>/);
  assert.doesNotMatch(page, /ContinueLearning/);
});

test("WEB-010 schema adds an encounter source/time index for recent lookups", async () => {
  const schema = await readText("prisma/schema.prisma");

  assert.match(schema, /@@index\(\[sourceType,\s*createdAt\]\)/);
});
