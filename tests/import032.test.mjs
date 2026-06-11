import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-7 M1 removes the local EPUB reflow-anchor system because epub.js owns pagination", async () => {
  const epub = await read("src/app/import/[id]/EpubReader.tsx");

  assert.match(epub, /import\("epubjs"\)/);
  assert.match(epub, /flow:\s*"paginated"/);
  assert.doesNotMatch(epub, /currentReflowAnchorRef/);
  assert.doesNotMatch(epub, /lastPaginationKeyRef/);
  assert.doesNotMatch(epub, /captureCurrentReflowAnchor/);
  assert.doesNotMatch(epub, /findPageForReflowAnchor/);
  assert.doesNotMatch(epub, /setPageInChapter\(\(\) => anchoredPage\)/);
});
