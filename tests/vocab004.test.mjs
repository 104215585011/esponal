import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("VOCAB-004 schema tracks dictionary data and encounter source type", async () => {
  const schema = await readText("prisma/schema.prisma");

  assert.match(schema, /dictData\s+Json\?/);
  assert.match(schema, /partOfSpeech\s+String\?/);
  assert.match(schema, /sourceType\s+String\s+@default\("video"\)/);
  assert.match(schema, /courseRef\s+String\?/);

  assert.ok(
    existsSync("prisma/migrations/20260515185000_add_dict_and_source_tracking/migration.sql")
  );
});

test("VOCAB-004 lookup route uses dictionary helper with Youdao and Redis fallback support", async () => {
  const routePath = "src/app/api/vocab/lookup/route.ts";
  assert.ok(existsSync(routePath), `${routePath} should exist`);

  const route = await readText(routePath);
  const helper = await readText("src/lib/dictionary.ts");

  assert.match(route, /export async function GET/);
  assert.match(route, /lookupDictionary/);
  assert.match(helper, /YOUDAO_APP_KEY/);
  assert.match(helper, /YOUDAO_APP_SECRET/);
  assert.match(helper, /vocab:dict:/);
  assert.match(helper, /FALLBACK_DICTIONARY/);
  assert.match(helper, /vivir/);
});

test("VOCAB-004 add route persists dictionary and source tracking payload", async () => {
  const route = await readText("src/app/api/vocab/add/route.ts");
  const lib = await readText("src/lib/vocab.ts");

  assert.match(route, /dictData/);
  assert.match(route, /partOfSpeech/);
  assert.match(route, /sourceType/);
  assert.match(route, /courseRef/);
  assert.match(lib, /dictData/);
  assert.match(lib, /sourceType/);
  assert.match(lib, /courseRef/);
});

test("VOCAB-004 lookup card renders rich dictionary content and sends source metadata", async () => {
  const card = await readText("src/app/watch/LookupCard.tsx");

  assert.match(card, /\/api\/vocab\/lookup/);
  assert.match(card, /meanings/);
  assert.match(card, /examples/);
  assert.match(card, /dictData/);
  assert.match(card, /sourceType/);
  assert.match(card, /courseRef/);
});

test("VOCAB-004 course page wires text lookup into lesson content", async () => {
  const componentPath = "src/app/learn/[slug]/CourseLookupText.tsx";
  assert.ok(existsSync(componentPath), `${componentPath} should exist`);

  const component = await readText(componentPath);
  const page = await readText("src/app/learn/[slug]/page.tsx");

  assert.match(component, /LookupCard/);
  assert.match(component, /type: "course"/);
  assert.match(component, /courseRef/);
  assert.match(page, /CourseLookupText/);
  assert.match(page, /#vocab/);
  assert.match(page, /#dialogues/);
});

test("VOCAB-004 vocab page displays video and course encounters", async () => {
  const accordion = await readText("src/app/components/vocab/VocabAccordion.tsx");
  const page = await readText("src/app/vocab/page.tsx");

  assert.match(accordion, /sourceType/);
  assert.match(accordion, /buildVideoJumpHref/);
  assert.match(accordion, /courseRef/);
  assert.match(accordion, /查看/);
  assert.match(page, /getMeanings/);
  assert.match(page, /getExamples/);
});
