import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

async function readText(path) {
  return readFileSync(path, "utf8");
}

test("COURSE-006 adds a dissect analyze API with implied-subject JSON contract", async () => {
  const routePath = "src/app/api/dissect/analyze/route.ts";
  assert.ok(existsSync(routePath), "analyze route should exist");

  const route = await readText(routePath);

  assert.match(route, /POST/);
  assert.match(route, /sentence/);
  assert.match(route, /tokens/);
  assert.match(route, /impliedSubject/);
  assert.match(route, /naturalEnglish/);
  assert.match(route, /insertBeforeIndex/);
  assert.match(route, /json/);
  assert.match(route, /400/);
});

test("COURSE-006 DissectorClient keeps immediate skeleton highlighting and adds async gloss states", async () => {
  const client = await readText("src/app/dissect/DissectorClient.tsx");

  assert.match(client, /analysis/);
  assert.match(client, /"loading"/);
  assert.match(client, /"error"/);
  assert.match(client, /fetch\("\/api\/dissect\/analyze"/);
  assert.match(client, /setActivePopover\(null\)/);
  assert.match(client, /鍒嗘瀽涓€?/);
  assert.match(client, /鍒嗘瀽鏆備笉鍙敤/);
  assert.match(client, /閫愯瘝瀵圭収/);
  assert.match(client, /naturalEnglish/);
  assert.match(client, /text-brand-600/);
  assert.match(client, /\[you\]|\[I\]/);
});

test("COURSE-006 interlinear gloss UI uses aligned token columns and separate natural English footer", async () => {
  const client = await readText("src/app/dissect/DissectorClient.tsx");

  assert.match(client, /flex flex-nowrap overflow-x-auto/);
  assert.match(client, /inline-flex flex-col items-center/);
  assert.match(client, /min-w-\[2rem\]/);
  assert.match(client, /bg-brand-50 text-brand-600 rounded px-1\.5/);
  assert.match(client, /italic text-brand-400/);
  assert.match(client, /text-\[10px\] text-brand-300/);
  assert.match(client, /border-t mt-4 pt-4/);
  assert.match(client, /鈫?/);
});
