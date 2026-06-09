import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-3 PDF reader supports readable zoom and clickable text lookup", async () => {
  const client = await read("src/app/import/[id]/ImportReaderClient.tsx");
  const lookupCard = await read("src/app/watch/LookupCard.tsx");

  assert.match(client, /const PDF_DEFAULT_ZOOM\s*=\s*1\.[3-9]/);
  assert.match(client, /setPdfZoom/);
  assert.match(client, /ZoomIn/);
  assert.match(client, /ZoomOut/);
  assert.match(client, /overflow-x-auto/);
  assert.match(client, /minWidth:\s*canvasCssSize\.width/);

  assert.match(client, /page\.getTextContent\(\)/);
  assert.match(client, /PDF_WORD_PATTERN/);
  assert.match(client, /data-testid="import-pdf-text-layer"/);
  assert.match(client, /data-testid="import-pdf-word"/);
  assert.match(client, /onClick=\{\(event\)\s*=>\s*openPdfLookup/);
  assert.match(client, /LookupCardStack/);
  assert.match(client, /onExampleWordClick:\s*openNestedPdfWord/);
  assert.match(client, /onRelatedPhraseClick:\s*openNestedPdfPhrase/);

  assert.match(lookupCard, /type:\s*"import"/);
  assert.match(lookupCard, /import:\$\{resolvedSource\.documentId\}:p\$\{resolvedSource\.pageNumber\}/);
});
