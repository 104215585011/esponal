import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("WEB-005 lookup card exists and calls lemmatize plus vocab add routes", async () => {
  const cardPath = "src/app/watch/LookupCard.tsx";
  assert.ok(existsSync(cardPath), `${cardPath} should exist`);

  const card = await readText(cardPath);

  assert.match(card, /\/api\/lemmatize/);
  assert.match(card, /\/api\/vocab\/add/);
  assert.match(card, /timestampSec/);
});

test("WEB-005 subtitle panel renders per-word spans and click handler", async () => {
  const panelPath = "src/app/watch/SubtitlePanel.tsx";
  assert.ok(existsSync(panelPath), `${panelPath} should exist`);

  const panel = await readText(panelPath);

  assert.match(panel, /splitSubtitleTokens/);
  assert.match(panel, /setActiveLookup/);
  assert.match(panel, /LookupCard/);
});
