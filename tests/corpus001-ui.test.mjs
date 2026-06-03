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
  assert.match(page, /className="hidden md:block"/);
  assert.match(page, /className="md:hidden"/);
  assert.match(page, /<CorpusMobile words=\{serializedWords\} \/>/);
  assert.match(page, /语料库|璇枡搴?/);
});

test("CORPUS-001 bottom tab uses corpus label instead of old vocab label", async () => {
  const tabPath = "src/app/components/web/BottomTabBar.tsx";
  assert.equal(existsSync(tabPath), true, `${tabPath} should exist`);

  const tabs = await readText(tabPath);

  assert.match(tabs, /href:\s*"\/vocab"/);
  assert.match(tabs, /label:\s*"语料库"|label:\s*"璇枡搴?"/);
  assert.doesNotMatch(tabs, /label:\s*"词库"/);
});

test("CORPUS-001 mobile corpus shell provides three tabs, lazy loaders, and phrase lookup reuse", async () => {
  const mobilePath = "src/app/vocab/CorpusMobile.tsx";
  assert.equal(existsSync(mobilePath), true, `${mobilePath} should exist`);

  const mobile = await readText(mobilePath);

  assert.match(mobile, /"use client"/);
  assert.match(mobile, /useState/);
  assert.match(mobile, /"video" \| "word" \| "phrase"/);
  assert.match(mobile, /useState<"video" \| "word" \| "phrase">\("video"\)/);
  assert.match(mobile, /pb-\[calc\(3\.5rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(mobile, /sticky top-\[52px\]/);
  assert.match(mobile, /role="tablist"/);
  assert.match(mobile, /视频|瑙嗛/);
  assert.match(mobile, /单词|鍗曡瘝/);
  assert.match(mobile, /短语|鐭/);
  assert.match(mobile, /VocabAccordion/);
  assert.match(mobile, /LookupCardStack/);
  assert.match(mobile, /lookupKind:\s*"phrase"/);
  assert.match(mobile, /phraseKind:/);
  assert.match(mobile, /fetchJsonWithTimeout<\{ videos\?: VideoView\[] \}>/);
  assert.match(mobile, /fetchJsonWithTimeout<\{ phrases\?: SavedPhrase\[] \}>/);
  assert.match(mobile, /"\/api\/watch\/history"/);
  assert.match(mobile, /"\/api\/vocab\/phrase\/list"/);
  assert.match(mobile, /AbortController/);
  assert.match(mobile, /CORPUS_FETCH_TIMEOUT_MS = 5000/);
  assert.match(mobile, /controller\.abort\(\)/);
  assert.match(mobile, /requestedAt: number \| null/);
  assert.match(mobile, /setTimeout\(\(\) =>/);
  assert.match(mobile, /console\.info\("\[CORPUS\] history loaded"/);
  assert.match(mobile, /console\.info\("\[CORPUS\] phrases loaded"/);
  assert.match(mobile, /debugCorpus/);
  assert.match(mobile, /useSearchParams/);
  assert.match(mobile, /history: \{videoState\.status\}/);
  assert.match(mobile, /phrases: \{phraseState\.status\}/);
  assert.match(mobile, /kind="loading-failed"/);
  assert.match(mobile, /kind="empty"/);
  assert.match(mobile, /from "lucide-react"/);
  assert.match(mobile, /\bPlay\b/);
  assert.match(mobile, /\bBookText\b/);
  assert.match(mobile, /\bQuote\b/);
  assert.doesNotMatch(mobile, /function PlayIcon/);
  assert.doesNotMatch(mobile, /function BookIcon/);
  assert.doesNotMatch(mobile, /function QuoteIcon/);
  assert.match(mobile, /explanationZh/);
  assert.match(mobile, /line-clamp-2 text-sm text-zinc-500/);
});

test("CORPUS-001 exposes a dedicated saved-phrase list route", async () => {
  const routePath = "src/app/api/vocab/phrase/list/route.ts";
  assert.equal(existsSync(routePath), true, `${routePath} should exist`);

  const route = await readText(routePath);

  assert.match(route, /export async function GET/);
  assert.match(route, /getSavedPhrasesByUser/);
  assert.match(route, /getServerSession\(getAuthOptions\(\)\)/);
  assert.match(route, /checkRateLimit/);
  assert.match(route, /phrases:/);
});
