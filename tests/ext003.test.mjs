import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

test("EXT-003 lemmatize route exists and returns lemma payload shape", async () => {
  const routePath = "src/app/api/lemmatize/route.ts";
  assert.ok(existsSync(routePath), `${routePath} should exist`);

  const route = await readText(routePath);

  assert.match(route, /export\s+async\s+function\s+POST/);
  assert.match(route, /lemma/);
  assert.match(route, /morphInfo/);
  assert.match(route, /translation/);
  assert.match(route, /lemma-dict\.json/);
  assert.match(route, /NextResponse\.json/);
});

test("EXT-003 lemma dictionary exists and covers reviewed forms", async () => {
  const dictPath = "extension/lemma-dict.json";
  assert.ok(existsSync(dictPath), `${dictPath} should exist`);

  const dict = await readJson(dictPath);

  for (const form of ["fui", "fueron", "vas", "hablan", "soy", "eres", "tiene"]) {
    assert.ok(dict[form], `${form} should exist in lemma dictionary`);
    assert.equal(typeof dict[form].lemma, "string");
    assert.equal(typeof dict[form].morphInfo, "string");
    assert.equal(typeof dict[form].translation, "string");
  }

  assert.ok(
    Object.keys(dict).length >= 500,
    "lemma dictionary should cover at least 500 forms"
  );
});

test("EXT-003 vocab add route exists and requires auth-aware save payload", async () => {
  const routePath = "src/app/api/vocab/add/route.ts";
  assert.ok(existsSync(routePath), `${routePath} should exist`);

  const route = await readText(routePath);

  assert.match(route, /getServerSession\(getAuthOptions\(\)\)/);
  assert.match(route, /status:\s*401/);
  assert.match(route, /createWord/);
  assert.match(route, /addEncounter/);
  assert.match(route, /sourceUrl/);
  assert.match(route, /timestampSec/);
  assert.match(route, /originalSentence/);
});

test("EXT-003 content script contains clickable word spans and lookup card hooks", async () => {
  const content = await readText("extension/content.js");

  assert.match(content, /esponal-word|es-word/);
  assert.match(content, /data-word/);
  assert.match(content, /2147483644/);
  assert.match(content, /Escape/);
  assert.match(content, /addEventListener\("pointerdown"/);
  assert.match(content, /api\/lemmatize/);
  assert.match(content, /api\/vocab\/add/);
});
