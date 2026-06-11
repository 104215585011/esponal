import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-7 PDF loads through pdf.js Range URL instead of buffering the whole file", async () => {
  const pdf = await read("src/app/import/[id]/PdfReader.tsx");
  const fileRoute = await read("src/app/api/import/[id]/file/route.ts");

  assert.doesNotMatch(pdf, /response\.arrayBuffer\(\)/);
  assert.doesNotMatch(pdf, /new Uint8Array\(buffer\)/);
  assert.doesNotMatch(pdf, /getDocument\(\{\s*data:\s*bytes\s*\}\)/);
  assert.match(pdf, /const PDF_RANGE_CHUNK_SIZE = 65536/);
  assert.match(pdf, /getDocument\(\{\s*url:\s*readerUrl,\s*rangeChunkSize:\s*PDF_RANGE_CHUNK_SIZE,\s*disableAutoFetch:\s*true,\s*disableStream:\s*false/s);
  assert.match(pdf, /hasEnteredViewport/);
  assert.match(pdf, /rootMargin:\s*"900px 0px"/);

  assert.match(fileRoute, /request\.headers\.get\("range"\)/);
  assert.match(fileRoute, /status:\s*range \? 206 : 200/);
  assert.match(fileRoute, /status:\s*upstream\.status === 206 \? 206 : 200/);
  assert.match(fileRoute, /"Accept-Ranges"/);
  assert.match(fileRoute, /"Content-Range"/);
  assert.match(fileRoute, /headers:\s*rangeHeader \? \{\s*Range:\s*rangeHeader\s*\}/s);
});

test("IMPORT-7 PDF sizing is fit-to-screen and EPUB uses epub.js paginated rendering", async () => {
  const pdf = await read("src/app/import/[id]/PdfReader.tsx");
  const epub = await read("src/app/import/[id]/EpubReader.tsx");

  assert.doesNotMatch(pdf, /effectivePdfZoom/);
  assert.doesNotMatch(pdf, /ZoomIn/);
  assert.doesNotMatch(pdf, /ZoomOut/);
  assert.doesNotMatch(pdf, /Math\.min\(920,\s*frameWidth/);
  assert.match(pdf, /const widthScale = frameSize\.width \/ baseViewport\.width/);
  assert.match(pdf, /const heightScale = availableHeight \/ baseViewport\.height/);
  assert.match(pdf, /Math\.min\(widthScale,\s*heightScale\)/);
  assert.match(pdf, /pdfFrameSize/);

  assert.match(epub, /import\("epubjs"\)/);
  assert.match(epub, /book\.renderTo/);
  assert.match(epub, /flow:\s*"paginated"/);
  assert.match(epub, /spread:\s*"none"/);
  assert.match(epub, /data-testid="import-epubjs-stage"/);
  assert.doesNotMatch(epub, /columnFill/);
  assert.doesNotMatch(epub, /columnWidth/);
  assert.doesNotMatch(epub, /width:\s*pageWidth \|\| undefined/);
  assert.doesNotMatch(epub, /verticalPages/);
  assert.doesNotMatch(epub, /Math\.round\(content\.scrollWidth/);
  assert.doesNotMatch(epub, /\[&_img\]:break-inside-avoid/);
  assert.doesNotMatch(epub, /\[&_figure\]:break-inside-avoid/);
});
