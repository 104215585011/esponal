import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

const STORY_FILES = [
  "content/lectura/types.ts",
  "content/lectura/index.ts",
  "content/lectura/la-tortuga-y-la-liebre.ts",
  "content/lectura/el-leon-y-el-raton.ts",
  "content/lectura/el-flautista-de-hamelin.ts",
  "content/lectura/un-dia-en-madrid.ts",
  "content/lectura/el-cafe-de-las-mananas.ts"
];

test("READ-001 lectura content files exist and export shape", async () => {
  for (const path of STORY_FILES) {
    assert.equal(existsSync(path), true, `${path} missing`);
  }

  const index = await readText("content/lectura/index.ts");
  assert.match(index, /export const lecturaStories/);
  assert.match(index, /export function getLecturaStory/);

  // Each story has slug, level, paragraphs >= 1
  for (const path of STORY_FILES.slice(2)) {
    const src = await readText(path);
    assert.match(src, /slug:/);
    assert.match(src, /level:\s*"(A1|A2|B1)"/);
    assert.match(src, /paragraphs:\s*\[/);
  }
});

test("READ-001 /lectura list page imports stories and renders cards", async () => {
  const path = "src/app/lectura/page.tsx";
  assert.equal(existsSync(path), true, `${path} missing`);
  const page = await readText(path);

  assert.match(page, /dynamic\s*=\s*"force-dynamic"/);
  assert.doesNotMatch(page, /dynamic\s*=\s*"force-static"/);
  assert.match(page, /lecturaStories/);
  assert.match(page, /lecturaStories\.map/);
  assert.match(page, /\/lectura\/\$\{story\.slug\}/);
  assert.match(page, /SiteHeader/);
  assert.match(page, /durationMin/);
});

test("READ-001 /lectura/[slug] static params and reader mount", async () => {
  const path = "src/app/lectura/[slug]/page.tsx";
  assert.equal(existsSync(path), true, `${path} missing`);
  const page = await readText(path);

  assert.match(page, /dynamic\s*=\s*"force-dynamic"/);
  assert.doesNotMatch(page, /dynamic\s*=\s*"force-static"/);
  assert.match(page, /generateStaticParams/);
  assert.match(page, /getLecturaStory/);
  assert.match(page, /notFound/);
  assert.match(page, /LecturaReader/);
  assert.match(page, /story={story}/);
});

test("READ-001 LecturaReader tokenizes paragraphs and wires LookupCard with lectura source", async () => {
  const path = "src/app/lectura/LecturaReader.tsx";
  assert.equal(existsSync(path), true, `${path} missing`);
  const src = await readText(path);

  assert.match(src, /"use client"/);
  assert.match(src, /LookupCard/);
  assert.match(src, /splitParagraphTokens|match\(\/\\S\+\|\\s\+\/g\)/);
  assert.match(src, /type:\s*"lectura"/);
  assert.match(src, /storySlug:\s*story\.slug/);
  assert.match(src, /paragraphIndex/);
  assert.match(src, /Escape/);
  assert.match(src, /data-testid="lectura-reader"/);
  assert.match(src, /id=\{`p\$\{paragraphIndex\}`\}/);
});

test("READ-001 LookupCard source type accepts lectura variant", async () => {
  const src = await readText("src/app/watch/LookupCard.tsx");
  assert.match(src, /type:\s*"lectura"/);
  assert.match(src, /storySlug:\s*string/);
  assert.match(src, /paragraphIndex:\s*number/);
  assert.match(src, /sourceType:\s*resolvedSource\.type/);
  assert.match(src, /lectura:\$\{resolvedSource\.storySlug\}\/p\$\{resolvedSource\.paragraphIndex\}/);
});

test("READ-001 SiteNav exposes /lectura entry", async () => {
  const src = await readText("src/app/components/web/SiteNav.tsx");
  assert.match(src, /href:\s*"\/lectura"/);
  assert.match(src, /阅读/);
});

test("READ-001 VocabAccordion handles lectura source type", async () => {
  const src = await readText("src/app/components/vocab/VocabAccordion.tsx");
  assert.match(src, /sourceType\s*===\s*"lectura"/);
  assert.match(src, /阅读/);
});
