import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

// VOCAB-002 change timestamp: 2026-05-13 13:54
const readText = (path) => readFile(path, "utf8");

test("/vocab page requires authentication and loads current user's words", async () => {
  const pagePath = "src/app/vocab/page.tsx";
  assert.ok(existsSync(pagePath), `${pagePath} should exist`);

  const page = await readText(pagePath);

  assert.match(page, /getServerSession\(authOptions\)/);
  assert.match(page, /redirect\(["']\/api\/auth\/signin["']\)/);
  assert.match(page, /getWordsByUser\(session\.user\.id\)/);
  assert.match(page, /我的词库/);
  assert.match(page, /按词根归类，记录你遭遇过的词/);
  assert.match(page, /max-w-2xl/);
  assert.match(page, /bg-\[#F9FAFB\]/);
});

test("/vocab page serializes words by most recent encounter for the client accordion", async () => {
  const page = await readText("src/app/vocab/page.tsx");

  assert.match(page, /VocabAccordion/);
  assert.match(page, /encounters\[0\]\?\.createdAt/);
  assert.match(page, /sort\(/);
  assert.match(page, /toISOString\(\)/);
  assert.doesNotMatch(page, /status/);
});

test("vocab accordion renders reviewed row, encounter, divider, and empty states", async () => {
  const componentPath = "src/app/components/vocab/VocabAccordion.tsx";
  assert.ok(existsSync(componentPath), `${componentPath} should exist`);

  const component = await readText(componentPath);

  assert.match(component, /"use client"/);
  assert.match(component, /useState/);
  assert.match(component, /遭遇 \{word\.encounterCount\} 次/);
  assert.match(component, /rounded-xl border border-gray-100 bg-white p-4/);
  assert.match(component, /bg-gray-50/);
  assert.match(component, /跳回视频/);
  assert.match(component, /min-h-\[44px\]/);
  assert.match(component, /italic/);
  assert.match(component, /还没有遭遇过词汇/);
  assert.match(component, /看视频时遇到的词会自动收录到这里。/);
  assert.match(component, /min-h-\[240px\]/);
  assert.match(component, /date divider/i);
  assert.doesNotMatch(component, /known|learning|掌握|未掌握/i);
});
