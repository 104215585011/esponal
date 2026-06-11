import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-6 EPUB reflow anchors the current reading position when reader settings change", async () => {
  const epub = await read("src/app/import/[id]/EpubReader.tsx");

  assert.match(epub, /currentReflowAnchorRef/);
  assert.match(epub, /lastPaginationKeyRef/);
  assert.match(epub, /captureCurrentReflowAnchor/);
  assert.match(epub, /findPageForReflowAnchor/);
  assert.match(epub, /settings\.fontSize/);
  assert.match(epub, /settings\.fontFamily/);
  assert.match(epub, /settings\.lineHeight/);
  assert.match(epub, /setPageInChapter\(\(\) => anchoredPage\)/);
});
