import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-3/7 PDF reader supports continuous fit-screen rendering and clickable text lookup", async () => {
  const pdf = await read("src/app/import/[id]/PdfReader.tsx");
  const lookupCard = await read("src/app/watch/LookupCard.tsx");

  assert.doesNotMatch(pdf, /const PDF_DEFAULT_ZOOM/);
  assert.doesNotMatch(pdf, /function calculateAdaptivePdfZoom/);
  assert.doesNotMatch(pdf, /PDF_AUTO_MIN_ZOOM/);
  assert.doesNotMatch(pdf, /PDF_AUTO_MAX_ZOOM/);
  assert.doesNotMatch(pdf, /frameWidth >= 430 \? 0\.16/);
  assert.doesNotMatch(pdf, /frameWidth >= 430 \? 0\.03/);
  assert.match(pdf, /ResizeObserver/);
  assert.match(pdf, /pdfFrameRef/);
  assert.doesNotMatch(pdf, /pdfFrameHeight,\s*setPdfFrameHeight/);
  assert.doesNotMatch(pdf, /pdfPageFitsViewport/);
  assert.doesNotMatch(pdf, /pdfZoomMode,\s*setPdfZoomMode/);
  assert.doesNotMatch(pdf, /setPdfZoomMode\("manual"\)/);
  assert.doesNotMatch(pdf, /const effectivePdfZoom\s*=\s*pdfZoomMode === "auto"/);
  assert.doesNotMatch(pdf, /calculateAdaptivePdfZoom\([^)]*pageNumber/);
  assert.doesNotMatch(pdf, /\$\{pageNumber\} \/ \$\{pageCount\}.*\$\{Math\.round\(pdfZoom \* 100\)\}%/);
  assert.doesNotMatch(pdf, /setPdfZoom/);
  assert.doesNotMatch(pdf, /ZoomIn/);
  assert.doesNotMatch(pdf, /ZoomOut/);
  assert.match(pdf, /const widthScale = frameSize\.width \/ baseViewport\.width/);
  assert.match(pdf, /const heightScale = availableHeight \/ baseViewport\.height/);
  assert.match(pdf, /Math\.min\(widthScale,\s*heightScale\)/);
  assert.match(pdf, /data-testid="import-pdf-continuous-scroll"/);
  assert.match(pdf, /data-testid="import-pdf-page-canvas"/);
  assert.match(pdf, /overflow-y-auto/);
  assert.match(pdf, /IntersectionObserver/);
  assert.doesNotMatch(pdf, /className="flex min-h-\[100dvh\] w-full justify-center overflow-x-auto"/);
  assert.match(pdf, /minWidth:\s*canvasCssSize\.width/);

  assert.match(pdf, /page\.getTextContent\(\)/);
  assert.match(pdf, /PDF_WORD_PATTERN/);
  assert.match(pdf, /data-testid="import-pdf-text-layer"/);
  assert.match(pdf, /data-testid="import-pdf-word"/);
  assert.match(pdf, /onClick=\{\(event\)\s*=>\s*openPdfLookup/);
  assert.match(pdf, /LookupCardStack/);
  assert.match(pdf, /onExampleWordClick:\s*openNestedPdfWord/);
  assert.match(pdf, /onRelatedPhraseClick:\s*openNestedPdfPhrase/);

  assert.match(lookupCard, /type:\s*"import"/);
  assert.match(lookupCard, /import:\$\{resolvedSource\.documentId\}:p\$\{resolvedSource\.pageNumber\}/);
});
