import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const readText = (path) => readFile(path, "utf8");
const readJson = async (path) => JSON.parse((await readText(path)).replace(/^\uFEFF/, ""));

test("COURSE-003 curriculum JSON files are valid and expose unit metadata", async () => {
  const manifestPath = "content/curriculum/units-manifest.json";
  const unitOnePath = "content/curriculum/unidad-1.json";

  assert.ok(existsSync(manifestPath), `${manifestPath} should exist`);
  assert.ok(existsSync(unitOnePath), `${unitOnePath} should exist`);

  const manifest = await readJson(manifestPath);
  const unitOne = await readJson(unitOnePath);

  assert.equal(manifest.length, 9);
  assert.ok(manifest.every((unit) => /^unidad-[1-9]$/.test(unit.slug)));
  assert.ok(manifest.every((unit) => unit.recommendedVideoId));
  assert.equal(unitOne.id, "unidad-1");
  assert.ok(unitOne.vocabGroups.length >= 4);
  assert.ok(unitOne.phrases.length >= 2);
  assert.ok(unitOne.dialogues.length >= 2);
  assert.ok(unitOne.grammarCards.length >= 3);
  assert.ok(unitOne.compareCards.length >= 3);
  assert.ok(unitOne.exercises.length >= 2);
  assert.ok(unitOne.recommendedVideo.videoId);

  for (const file of readdirSync("content/curriculum").filter((name) => name.endsWith(".json"))) {
    await readJson(`content/curriculum/${file}`);
  }
});

test("COURSE-003 curriculum library reads manifest and falls back to unidad-1 content", async () => {
  const libraryPath = "src/lib/curriculum.ts";
  assert.ok(existsSync(libraryPath), `${libraryPath} should exist`);

  const library = await readText(libraryPath);

  assert.match(library, /getAllUnits/);
  assert.match(library, /getUnitPageData/);
  assert.match(library, /units-manifest\.json/);
  assert.match(library, /unidad-1\.json/);
  assert.match(library, /existsSync/);
});

test("COURSE-003 /learn overview renders nine unit cards from the manifest", async () => {
  const pagePath = "src/app/learn/page.tsx";
  assert.ok(existsSync(pagePath), `${pagePath} should exist`);

  const page = await readText(pagePath);

  assert.match(page, /getAllUnits/);
  assert.match(page, /SiteHeader/);
  assert.match(page, /href=.+\/learn\/\$\{unit\.slug\}/s);
  assert.match(page, /coreVerbs\.map/);
  assert.match(page, /durationMin/);
  assert.match(page, /units\.length/);
});

test("COURSE-003 /learn/[slug] renders unit details, recommended video, and bottom nav", async () => {
  const pagePath = "src/app/learn/[slug]/page.tsx";
  assert.ok(existsSync(pagePath), `${pagePath} should exist`);

  const page = await readText(pagePath);

  assert.match(page, /generateStaticParams/);
  assert.match(page, /getUnitPageData/);
  assert.match(page, /sticky/);
  assert.match(page, /vocabGroups/);
  assert.match(page, /phrases/);
  assert.match(page, /dialogues/);
  assert.match(page, /grammarCards/);
  assert.match(page, /compareCards/);
  assert.match(page, /exercises/);
  assert.match(page, /details/);
  assert.match(page, /img\.youtube\.com\/vi\/\$\{content\.recommendedVideo\.videoId\}\/hqdefault\.jpg/);
  assert.match(page, /href=\{`\/watch\?v=\$\{content\.recommendedVideo\.videoId\}`\}/);
  assert.match(page, /prevUnit/);
  assert.match(page, /nextUnit/);
});

test("COURSE-003 SiteHeader sends the course link to /learn", async () => {
  const header = await readText("src/app/components/web/SiteHeader.tsx");

  assert.match(header, /href="\/learn"/);
  assert.doesNotMatch(header, /href="\/learn\/phase-1"/);
});

test("COURSE-003 audio button silently ignores empty audio sources", async () => {
  const button = await readText("src/app/components/audio/AudioButton.tsx");

  assert.match(button, /if \(!src\)/);
  assert.match(button, /return;/);
});
