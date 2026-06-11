import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-7 M1 uses epub.js for minimal paginated EPUB rendering", async () => {
  const pkg = JSON.parse(await read("package.json"));
  const epub = await read("src/app/import/[id]/EpubReader.tsx");

  assert.ok(pkg.dependencies?.epubjs, "epubjs dependency must be installed for the M1 reader");
  assert.match(epub, /import\("epubjs"\)/);
  assert.match(epub, /\/api\/import\/\$\{documentId\}\/file/);
  assert.match(epub, /response\.arrayBuffer\(\)/);
  assert.match(epub, /new Blob\(\[buffer\],\s*\{\s*type:\s*"application\/epub\+zip"\s*\}\)/);
  assert.match(epub, /URL\.createObjectURL/);
  assert.match(epub, /URL\.revokeObjectURL/);
  assert.match(epub, /book\.renderTo\(/);
  assert.match(epub, /flow:\s*"paginated"/);
  assert.match(epub, /spread:\s*"none"/);
  assert.match(epub, /rendition\.display\(/);
  assert.match(epub, /renditionReady/);
  assert.match(epub, /renditionRef\.current\?\.next\(\)/);
  assert.match(epub, /renditionRef\.current\?\.prev\(\)/);
  assert.match(epub, /data-testid="import-epubjs-stage"/);

  assert.doesNotMatch(epub, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(epub, /columnWidth/);
  assert.doesNotMatch(epub, /wrapSentencesInEpubHtml/);
  assert.doesNotMatch(epub, /data-epub-word/);
  assert.doesNotMatch(epub, /\/api\/import\/\$\{documentId\}\/url/);
  assert.doesNotMatch(epub, /payload\.url/);
  assert.doesNotMatch(epub, /\/api\/import\/\$\{documentId\}\/epub/);
});
