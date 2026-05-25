import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const readText = (path) => readFile(path, "utf8");

test("VOCAB-010 lookup route returns isSaved based on the signed-in user's saved lemma", async () => {
  const routePath = "src/app/api/vocab/lookup/route.ts";
  assert.ok(existsSync(routePath), `${routePath} should exist`);

  const route = await readText(routePath);

  assert.match(route, /getServerSession/);
  assert.match(route, /lookupDictionary/);
  assert.match(route, /isSaved/);
  assert.match(route, /getWordWithEncounters|prisma\.word\.find/);
  assert.match(route, /session\?\.user/);
});

test("VOCAB-010 LookupCard exposes an already_saved button state with amber styling and disabled interaction", async () => {
  const cardPath = "src/app/watch/LookupCard.tsx";
  assert.ok(existsSync(cardPath), `${cardPath} should exist`);

  const card = await readText(cardPath);

  assert.match(card, /type ButtonState = "default" \| "loading" \| "success" \| "login" \| "disabled" \| "already_saved"/);
  assert.match(card, /payload\.isSaved === true/);
  assert.match(card, /setButtonState\("already_saved"\)/);
  assert.match(card, /bg-amber-50 text-amber-600 cursor-default/);
  assert.match(card, /buttonState === "already_saved"/);
  assert.match(card, /\u5df2\u52a0\u5165\u8bcd\u5e93/);
});
