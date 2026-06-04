// Timestamp: 2026-06-04 10:53
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("HOME-001 keeps HomeHero but makes it session-aware", async () => {
  const path = "src/app/components/web/HomeHero.tsx";
  assert.equal(existsSync(path), true, `${path} missing`);
  const source = await readText(path);

  assert.match(source, /type HomeHeroProps = \{\s*isLoggedIn:\s*boolean;/);
  assert.match(source, /export function HomeHero\(\{ isLoggedIn \}: HomeHeroProps\)/);
  assert.match(source, /西班牙语，[\s\S]*从<span className="text-brand-700 md:text-brand-500">听懂<\/span>开始/);
  assert.match(source, /\/phonics/);
  assert.match(source, /#tools/);
  assert.doesNotMatch(source, /InstallPrompt/);
  assert.doesNotMatch(source, /\/extension/);
});

test("HOME-001 homepage adds learning path and tools while keeping curated video marker", async () => {
  const path = "src/app/page.tsx";
  assert.equal(existsSync(path), true, `${path} missing`);
  const page = await readText(path);

  assert.match(page, /getVocabStats/);
  assert.match(page, /prisma\.lecturaRead\.count/);
  assert.match(page, /<HomeHero isLoggedIn=\{!!userId\} \/>/);
  assert.match(page, /title:\s*"字母发音"/);
  assert.match(page, /title:\s*"对话"/);
  assert.match(page, /\/phonics/);
  assert.match(page, /\/learn/);
  assert.match(page, /\/lectura/);
  assert.match(page, /\/watch/);
  assert.match(page, /\/talk/);
  assert.match(page, /id="tools"/);
  assert.match(page, /\/dissect/);
  assert.match(page, /\/vocab/);
  assert.match(page, /curatedChannels/);
  assert.match(page, /video-sections/);
  assert.match(page, /Esponal 为中文母语者设计的西语学习平台/);
});

test("HOME-001 learning path keeps desktop arrows and desktop-only progress rings", async () => {
  const page = await readText("src/app/page.tsx");

  assert.match(page, /hidden lg:block text-gray-300 mt-8 text-lg/);
  assert.match(page, /stats\?\.totalSaved \?\? 119/);
  assert.match(page, /readCount \?\? 4/);
  assert.match(page, /hidden h-3\.5 w-3\.5 -rotate-90 shrink-0 md:inline/);
});

test("HOME-001 learning path cards reserve progress space and keep desktop equal heights", async () => {
  const page = await readText("src/app/page.tsx");

  assert.match(page, /data-testid="learning-step-card"/);
  assert.match(page, /flex flex-none basis-\[195px\] snap-start flex-col/);
  assert.match(page, /md:min-h-\[220px\] md:min-w-0 md:flex-1/);
  assert.match(page, /mt-3 min-h-\[22px\]/);
  assert.match(page, /className="mt-auto inline-flex/);
});
