import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-3 PDF reader supports adaptive stable zoom and clickable text lookup", async () => {
  const client = await read("src/app/import/[id]/ImportReaderClient.tsx");
  const lookupCard = await read("src/app/watch/LookupCard.tsx");

  assert.doesNotMatch(client, /const PDF_DEFAULT_ZOOM/);
  assert.match(client, /function calculateAdaptivePdfZoom/);
  assert.match(client, /PDF_AUTO_MIN_ZOOM/);
  assert.match(client, /const PDF_AUTO_MAX_ZOOM\s*=\s*1/);
  assert.doesNotMatch(client, /return PDF_AUTO_MAX_ZOOM/);
  assert.doesNotMatch(client, /frameWidth >= 430 \? 0\.16/);
  assert.doesNotMatch(client, /frameWidth >= 430 \? 0\.03/);
  assert.match(client, /ResizeObserver/);
  assert.match(client, /pdfFrameRef/);
  assert.match(client, /pdfFrameHeight,\s*setPdfFrameHeight/);
  assert.match(client, /pdfPageFitsViewport/);
  assert.match(client, /pdfZoomMode,\s*setPdfZoomMode/);
  assert.match(client, /setPdfZoomMode\("manual"\)/);
  assert.match(client, /const effectivePdfZoom\s*=\s*pdfZoomMode === "auto"/);
  assert.doesNotMatch(client, /calculateAdaptivePdfZoom\([^)]*pageNumber/);
  assert.doesNotMatch(client, /\$\{pageNumber\} \/ \$\{pageCount\} 路 \$\{Math\.round\(pdfZoom \* 100\)\}%/);
  assert.match(client, /setPdfZoom/);
  assert.match(client, /ZoomIn/);
  assert.match(client, /ZoomOut/);
  assert.match(client, /overflow-x-auto/);
  assert.doesNotMatch(client, /className="flex min-h-\[100dvh\] w-full justify-center overflow-x-auto"/);
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
