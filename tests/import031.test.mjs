import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-7 PDF uses a continuous WPS-style scroll preview instead of a single-page reader frame", async () => {
  const pdf = await read("src/app/import/[id]/PdfReader.tsx");
  const shell = await read("src/app/import/[id]/ImportReaderClient.tsx");

  assert.match(pdf, /data-testid="import-pdf-continuous-scroll"/);
  assert.match(pdf, /data-testid="import-pdf-page-canvas"/);
  assert.match(pdf, /Array\.from\(\{\s*length:\s*pdfDocument\.numPages\s*\}/s);
  assert.match(pdf, /IntersectionObserver/);
  assert.match(pdf, /scrollIntoView/);
  assert.doesNotMatch(pdf, /data-testid="import-pdf-page-strip"/);

  assert.match(shell, /kind === "epub" \? <div/);
  assert.match(shell, /data-testid="import-reader-bottom-chrome"/);
  assert.doesNotMatch(shell, /kind === "pdf" \? pageNumber : epubPageInChapter \+ 1/);
});

test("IMPORT-7 EPUB pagination uses horizontal columns and resets page position when chapters change", async () => {
  const epub = await read("src/app/import/[id]/EpubReader.tsx");
  const shell = await read("src/app/import/[id]/ImportReaderClient.tsx");

  assert.match(epub, /frame\.clientHeight/);
  assert.doesNotMatch(epub, /verticalPages/);
  assert.doesNotMatch(epub, /scrollHeight/);
  assert.match(epub, /columnFill:\s*"auto"/);
  assert.doesNotMatch(epub, /width:\s*pageWidth \|\| undefined/);
  assert.match(epub, /setPageInChapter\(\(\) => 0\)/);
  assert.match(epub, /pageHeight/);
  assert.match(shell, /setEpubPageInChapter\(0\)/);
});
