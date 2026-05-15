import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("WEB-003 watch page exists and embeds the YouTube player shell", async () => {
  const pagePath = "src/app/watch/page.tsx";
  assert.ok(existsSync(pagePath), `${pagePath} should exist`);

  const page = await readText(pagePath);

  assert.match(page, /youtube\.com\/embed/);
  assert.match(page, /enablejsapi=1/);
  assert.match(page, /TranscriptPanel/);
  assert.match(page, /RelatedPanel/);
});
