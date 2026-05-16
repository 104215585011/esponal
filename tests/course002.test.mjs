import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("COURSE-002 grammar content defines homepage order and required groups", async () => {
  const contentPath = "content/grammar/topics.ts";
  assert.ok(existsSync(contentPath), `${contentPath} should exist`);

  const content = await readText(contentPath);
  const expectedOrder = [
    "noun-gender",
    "ser-vs-estar",
    "regular-ar",
    "regular-er-ir",
    "stem-changing",
    "reflexive-verbs",
    "gustar",
    "articles",
    "adjective-agreement",
    "ir-a-infinitive"
  ];

  let lastIndex = -1;
  for (const slug of expectedOrder) {
    const index = content.search(new RegExp(`\\s+slug: "${slug}",\\r?\\n\\s+group:`));
    assert.ok(index > lastIndex, `${slug} should appear in homepage order`);
    lastIndex = index;
  }

  assert.match(content, /group:\s*"动词变位"/);
  assert.match(content, /group:\s*"名词性别"/);
  assert.match(content, /group:\s*"常见辨析"/);
  assert.match(content, /查看相关语法/);
});

test("COURSE-002 grammar pages render required responsive layout and semantic tables", async () => {
  const indexPath = "src/app/grammar/page.tsx";
  const detailPath = "src/app/grammar/[slug]/page.tsx";
  const selectPath = "src/app/grammar/GrammarTopicSelect.tsx";
  assert.ok(existsSync(indexPath), `${indexPath} should exist`);
  assert.ok(existsSync(detailPath), `${detailPath} should exist`);
  assert.ok(existsSync(selectPath), `${selectPath} should exist`);

  const indexPage = await readText(indexPath);
  const detailPage = await readText(detailPath);
  const selectComponent = await readText(selectPath);

  assert.match(indexPage, /语法话题/);
  assert.match(indexPage, /rounded-xl shadow-sm border border-gray-100/);
  const content = await readText("content/grammar/topics.ts");
  const combinedSource = `${indexPage}\n${content}`;
  assert.match(combinedSource, /动词变位/);
  assert.match(combinedSource, /名词性别/);
  assert.match(combinedSource, /常见辨析/);
  assert.match(indexPage, /→/);

  assert.match(detailPage, /w-\[220px\]/);
  assert.match(detailPage, /max-w-2xl/);
  assert.match(`${detailPage}\n${selectComponent}`, /<select/);
  assert.match(detailPage, /border-l-\[3px\] border-brand-500/);
  assert.doesNotMatch(detailPage, /bg-brand-50[^/]*active/);
  assert.match(detailPage, /<table/);
  assert.match(detailPage, /<th[\s\S]*?人称代词[\s\S]*?<\/th>/);
  assert.match(detailPage, /<th[\s\S]*?人称说明[\s\S]*?<\/th>/);
  assert.match(detailPage, /<th[\s\S]*?变位形式[\s\S]*?<\/th>/);
  assert.match(detailPage, /overflow-x-auto/);
  assert.match(detailPage, /sticky left-0/);
  assert.match(detailPage, /bg-gray-50/);
  assert.match(detailPage, /border-b border-gray-100/);
  assert.match(detailPage, /中文类比/);
  assert.match(detailPage, /border-l-\[3px\] border-brand-200/);
  assert.match(selectComponent, /"use client"/);
  assert.match(selectComponent, /useRouter/);
  assert.match(selectComponent, /router\.push\(`\/grammar\/\$\{event\.target\.value\}`\)/);
});

test("COURSE-002 grammar detail content keeps rule topics and removes duplicate single-verb pages", async () => {
  const content = await readText("content/grammar/topics.ts");

  for (const removedSlug of [
    "ser",
    "estar",
    "tener",
    "ir",
    "querer",
    "poder"
  ]) {
    assert.doesNotMatch(content, new RegExp(`\\s+slug: "${removedSlug}",\\r?\\n\\s+group:`));
  }

  for (const retainedSlug of [
    "regular-ar",
    "regular-er-ir",
    "stem-changing",
    "reflexive-verbs",
    "gustar",
    "articles",
    "adjective-agreement",
    "ir-a-infinitive"
  ]) {
    assert.match(content, new RegExp(`\\s+slug: "${retainedSlug}",\\r?\\n\\s+group:`));
  }

  assert.match(content, /阳性/);
  assert.match(content, /阴性/);
  assert.match(content, /-o/);
  assert.match(content, /-a/);
  assert.match(content, /ser/);
  assert.match(content, /estar/);
  assert.match(content, /身份|本质|状态|位置/);
  assert.match(content, /因为/);
});
