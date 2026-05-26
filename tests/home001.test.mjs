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
  assert.match(source, /西班牙语，从听懂开始/);
  assert.match(source, /\/phonics/);
  assert.match(source, /#tools/);
  assert.doesNotMatch(source, /InstallPrompt/);
  assert.doesNotMatch(source, /\/extension/);
});

test("HOME-001 homepage adds learning path and tools while keeping curated video sections", async () => {
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
  assert.match(page, /Esponal 路 为中文母语者设计的西语学习平台/);
});

test("HOME-001 learning path uses desktop arrows and logged-in-only progress lines", async () => {
  const page = await readText("src/app/page.tsx");

  assert.match(page, /hidden lg:block text-gray-300 mt-8 text-lg/);
  assert.match(page, /userId && stats \? `已收藏 \$\{stats\.totalSaved\} 词` : undefined/);
  assert.match(page, /userId \? `已读 \$\{readCount\} 篇` : undefined/);
});
