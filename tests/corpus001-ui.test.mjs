import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("CORPUS-001 mobile vocab page splits desktop and mobile corpus layouts", async () => {
  const pagePath = "src/app/vocab/page.tsx";
  assert.equal(existsSync(pagePath), true, `${pagePath} should exist`);

  const page = await readText(pagePath);

  assert.match(page, /CorpusMobile/);
  assert.match(page, /getVideoViewsByUser/);
  assert.match(page, /getSavedPhrasesByUser/);
  assert.match(page, /listImportedArticlesForUser/);
  assert.match(page, /serializedVideoViews/);
  assert.match(page, /serializedImportedArticles/);
  assert.match(page, /serializedPhrases/);
  assert.match(page, /className="hidden md:block"/);
  assert.match(page, /className="md:hidden"/);
  assert.match(page, /<CorpusMobile/);
  assert.match(page, /words=\{serializedWords\}/);
  assert.match(page, /initialVideoViews=\{serializedVideoViews\}/);
  assert.match(page, /initialImportedArticles=\{serializedImportedArticles\}/);
  assert.match(page, /initialPhrases=\{serializedPhrases\}/);
  assert.match(page, /我的语料库/);
});

test("CORPUS-001 → MOBILE-R2: 语料库 becomes a push entry, the tab bar only carries the five shell tabs", async () => {
  const routes = await readText("src/app/components/shell/routes.ts");
  const shell = await readText("src/app/components/shell/AppShell.tsx");

  // 语料库仍是可达入口,但降为推入页(父 tab = 首页)
  assert.match(routes, /path:\s*"\/vocab", label: "语料库", level: "push", parentTab: "\/"/);
  assert.doesNotMatch(shell, /label:\s*"语料库"/);
});

test("CORPUS-001 mobile corpus shell provides video, article, word, and phrase tabs", async () => {
  const mobilePath = "src/app/vocab/CorpusMobile.tsx";
  assert.equal(existsSync(mobilePath), true, `${mobilePath} should exist`);

  const mobile = await readText(mobilePath);

  assert.match(mobile, /"use client"/);
  assert.match(mobile, /useState/);
  assert.match(mobile, /initialVideoViews: VideoView\[]/);
  assert.match(mobile, /initialImportedArticles: ImportedArticle\[]/);
  assert.match(mobile, /initialPhrases: SavedPhrase\[]/);
  assert.match(mobile, /"video" \| "article" \| "word" \| "phrase"/);
  assert.match(mobile, /useState<"video" \| "article" \| "word" \| "phrase">\("video"\)/);
  assert.match(mobile, /grid-cols-4/);
  assert.match(mobile, /role="tablist"/);
  assert.match(mobile, /视频/);
  assert.match(mobile, /文章/);
  assert.match(mobile, /单词/);
  assert.match(mobile, /短语/);
  assert.match(mobile, /href=\{`\/import\/\$\{article\.id\}`\}/);
  assert.match(mobile, /article\.kind === "epub" \? "EPUB" : "PDF"/);
  assert.match(mobile, /items: initialImportedArticles/);
  assert.match(mobile, /articles: \{articleState\.status\}/);
  assert.match(mobile, /VocabAccordion/);
  assert.match(mobile, /LookupCardStack/);
  assert.match(mobile, /lookupKind:\s*"phrase"/);
  assert.match(mobile, /phraseKind:/);
  assert.match(mobile, /debugCorpus/);
  assert.match(mobile, /history: \{videoState\.status\}/);
  assert.match(mobile, /phrases: \{phraseState\.status\}/);
  assert.match(mobile, /kind="loading-failed"/);
  assert.match(mobile, /kind="empty"/);
});

test("CORPUS-001 import article helper returns only ready PDF and EPUB documents", async () => {
  const servicePath = "src/lib/import/service.ts";
  assert.equal(existsSync(servicePath), true, `${servicePath} should exist`);

  const service = await readText(servicePath);

  assert.match(service, /export async function listImportedArticlesForUser/);
  assert.match(service, /status:\s*"ready"/);
  assert.match(service, /kind:\s*\{\s*in:\s*\["pdf",\s*"epub"\]/);
  assert.match(service, /orderBy:\s*\{\s*createdAt:\s*"desc"/);
});

test("CORPUS-001 exposes a dedicated saved-phrase list route", async () => {
  const routePath = "src/app/api/vocab/phrase/list/route.ts";
  assert.equal(existsSync(routePath), true, `${routePath} should exist`);

  const route = await readText(routePath);

  assert.match(route, /export async function GET/);
  assert.match(route, /getSavedPhrasesByUser/);
  assert.match(route, /getAuthedUserId|getServerSession/);
  assert.match(route, /checkRateLimit/);
  assert.match(route, /phrases:/);
});
