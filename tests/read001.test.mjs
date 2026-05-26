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

  for (const path of STORY_FILES.slice(2)) {
    const source = await readText(path);
    assert.match(source, /slug:/);
    assert.match(source, /level:\s*"(A1|A2|B1)"/);
    assert.match(source, /paragraphs:\s*\[/);
  }
});

test("READ-001 /lectura list page imports stories and renders cards", async () => {
  const path = "src/app/lectura/page.tsx";
  assert.equal(existsSync(path), true, `${path} missing`);
  const page = await readText(path);

  assert.match(page, /dynamic\s*=\s*"force-dynamic"/);
  assert.doesNotMatch(page, /dynamic\s*=\s*"force-static"/);
  assert.match(page, /lecturaStories/);
  assert.match(page, /\.map\(\(story\)/);
  assert.match(page, /levelOrder/);
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
  const source = await readText(path);

  assert.match(source, /"use client"/);
  assert.match(source, /LookupCard/);
  assert.match(source, /splitParagraphTokens|match\(\/\\S\+\|\\s\+\/g\)/);
  assert.match(source, /type:\s*"lectura"/);
  assert.match(source, /storySlug:\s*story\.slug/);
  assert.match(source, /paragraphIndex/);
  assert.match(source, /Escape/);
  assert.match(source, /data-testid="lectura-reader"/);
  assert.match(source, /id=\{`p\$\{paragraphIndex\}`\}/);
});

test("READ-001 LookupCard source type accepts lectura variant", async () => {
  const source = await readText("src/app/watch/LookupCard.tsx");
  assert.match(source, /type:\s*"lectura"/);
  assert.match(source, /storySlug:\s*string/);
  assert.match(source, /paragraphIndex:\s*number/);
  assert.match(source, /sourceType:\s*resolvedSource\.type/);
  assert.match(source, /lectura:\$\{resolvedSource\.storySlug\}\/p\$\{resolvedSource\.paragraphIndex\}/);
});

test("READ-001 SiteNav exposes /lectura entry", async () => {
  const source = await readText("src/app/components/web/SiteNav.tsx");
  assert.match(source, /href:\s*"\/lectura"/);
  assert.match(source, /label:\s*"阅读"/);
});

test("READ-001 VocabAccordion handles lectura source type", async () => {
  const source = await readText("src/app/components/vocab/VocabAccordion.tsx");
  assert.match(source, /sourceType\s*===\s*"lectura"/);
  assert.match(source, /badgeLabel[\s\S]*"阅读"/);
});

test("READ-001 adds LecturaRead persistence schema and API routes", async () => {
  const schema = await readText("prisma/schema.prisma");
  assert.match(schema, /model LecturaRead/);
  assert.match(schema, /slug\s+String/);
  assert.match(schema, /readAt\s+DateTime\s+@default\(now\(\)\)/);
  assert.match(schema, /@@unique\(\[userId,\s*slug\]\)/);
  assert.match(schema, /@@map\("lectura_reads"\)/);

  const postRoute = await readText("src/app/api/lectura/[slug]/read/route.ts");
  assert.match(postRoute, /export async function POST/);
  assert.match(postRoute, /getServerSession/);
  assert.match(postRoute, /status:\s*401/);
  assert.match(postRoute, /prisma\.lecturaRead\.upsert/);
  assert.match(postRoute, /userId_slug/);

  const getRoute = await readText("src/app/api/lectura/reads/route.ts");
  assert.match(getRoute, /export async function GET/);
  assert.match(getRoute, /getServerSession/);
  assert.match(getRoute, /status:\s*401/);
  assert.match(getRoute, /prisma\.lecturaRead\.findMany/);
  assert.match(getRoute, /slugs/);
});

test("READ-001 list and reader expose read progress UI", async () => {
  const listPage = await readText("src/app/lectura/page.tsx");
  assert.match(listPage, /getServerSession/);
  assert.match(listPage, /readSlugs/);
  assert.match(listPage, /lecturaRead\.findMany/);
  assert.match(listPage, /border-emerald-100/);
  assert.match(listPage, /ml-1\.5 text-emerald-500/);

  const slugPage = await readText("src/app/lectura/[slug]/page.tsx");
  assert.match(slugPage, /getServerSession/);
  assert.match(slugPage, /prisma\.lecturaRead\.findUnique/);
  assert.match(slugPage, /isRead/);
  assert.match(slugPage, /<LecturaReader story=\{story\} isRead=\{isRead\}/);

  const reader = await readText("src/app/lectura/LecturaReader.tsx");
  assert.match(reader, /isRead:\s*boolean/);
  assert.match(reader, /const \[isMarked,\s*setIsMarked\]/);
  assert.match(reader, /fetch\(`\/api\/lectura\/\$\{story\.slug\}\/read`/);
  assert.match(reader, /window\.scrollY \+ window\.innerHeight/);
  assert.match(reader, /document\.documentElement\.scrollHeight/);
  assert.match(reader, />=\s*90/);
  assert.match(reader, /cursor-default/);
});
