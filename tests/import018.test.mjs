import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-3 v2 adds an authenticated metadata-backed import library page", async () => {
  const pagePath = "src/app/import/library/page.tsx";
  assert.equal(existsSync(pagePath), true, `${pagePath} missing`);

  const source = await read(pagePath);
  assert.match(source, /dynamic\s*=\s*"force-dynamic"/);
  assert.match(source, /getServerSession/);
  assert.match(source, /listImportedDocumentsForUser/);
  assert.match(source, /href="\/import"/);
  assert.match(source, /groupImportedDocuments/);
  assert.match(source, /group\.documents\.map/);
  assert.match(source, /href=\{`\/import\/\$\{document\.id\}`\}/);
  assert.match(source, /status\s*===\s*"failed"/);
  assert.match(source, /ImportDeleteButton/);
  assert.match(source, /border-red-200/);
  assert.match(source, /hover:border-brand-300/);
  assert.match(source, /formatSize/);
  assert.match(source, /unitCount/);
  assert.match(source, /lastPosition/);
  assert.doesNotMatch(source, /buildImportedDocumentProgress/);
  assert.doesNotMatch(source, /status\s*===\s*"processing"/);
});

test("IMPORT-3 library delete button calls the owner-scoped document delete API", async () => {
  const buttonPath = "src/app/import/library/ImportDeleteButton.tsx";
  assert.equal(existsSync(buttonPath), true, `${buttonPath} missing`);

  const source = await read(buttonPath);
  assert.match(source, /"use client"/);
  assert.match(source, /fetch\(`\/api\/import\/\$\{documentId\}`,\s*\{\s*method:\s*"DELETE"/);
  assert.match(source, /router\.refresh\(\)/);
  assert.match(source, /confirm\(/);
  assert.match(source, /Trash2/);
});

test("IMPORT-3 v2 reader fetches original PDF bytes before rendering with pdf.js", async () => {
  const pagePath = "src/app/import/[id]/page.tsx";
  const clientPath = "src/app/import/[id]/ImportReaderClient.tsx";
  const pdfPath = "src/app/import/[id]/PdfReader.tsx";
  const epubPath = "src/app/import/[id]/EpubReader.tsx";
  assert.equal(existsSync(pagePath), true, `${pagePath} missing`);
  assert.equal(existsSync(clientPath), true, `${clientPath} missing`);
  assert.equal(existsSync(pdfPath), true, `${pdfPath} missing`);
  assert.equal(existsSync(epubPath), true, `${epubPath} missing`);

  const page = await read(pagePath);
  assert.match(page, /dynamic\s*=\s*"force-dynamic"/);
  assert.match(page, /getServerSession/);
  assert.match(page, /getImportedDocumentByIdForUser/);
  assert.match(page, /notFound/);
  assert.match(page, /status\s*!==\s*"ready"/);
  assert.match(page, /ImportReaderClient/);
  assert.match(page, /kind=\{document\.kind\}/);
  assert.match(page, /lastPosition=\{document\.lastPosition\}/);
  assert.match(page, /unitCount=\{document\.unitCount\}/);
  assert.doesNotMatch(page, /lastPageIndex/);
  assert.doesNotMatch(page, /pageCount/);

  const client = await read(clientPath);
  const pdf = await read(pdfPath);
  const epub = await read(epubPath);
  assert.match(client, /"use client"/);
  assert.match(client, /data-testid="import-reader"/);
  assert.match(client, /setReaderUrl\(`\/api\/import\/\$\{documentId\}\/file`\)/);
  assert.match(client, /import \{ PdfReader \} from "\.\/PdfReader"/);
  assert.match(client, /import \{ EpubReader,\s*type EpubChapter \} from "\.\/EpubReader"/);
  assert.doesNotMatch(client, /fetch\(`\/api\/import\/\$\{documentId\}\/url`\)/);
  assert.doesNotMatch(client, /src=\{readerUrl\}/);
  assert.match(epub, /data-testid="import-epub-reader"/);
  assert.doesNotMatch(client, /打开 EPUB 原件/);
  assert.match(client, /kind === "pdf" && readerUrl/);

  assert.match(pdf, /await fetch\(readerUrl,\s*\{\s*cache:\s*"no-store",\s*credentials:\s*"same-origin"\s*\}\)/);
  assert.match(pdf, /await response\.arrayBuffer\(\)/);
  assert.match(pdf, /new Uint8Array\(buffer\)/);
  assert.match(pdf, /await import\("pdfjs-dist\/build\/pdf\.mjs"\)/);
  assert.match(pdf, /configurePdfJsWorker\(pdfjs\)/);
  assert.match(pdf, /const PDF_WORKER_SRC\s*=\s*"\/api\/import\/pdf-worker"/);
  assert.match(pdf, /pdfjs\.GlobalWorkerOptions\.workerSrc\s*=\s*PDF_WORKER_SRC/);
  assert.match(pdf, /pdfjs\.GlobalWorkerOptions\.workerPort\s*=\s*sharedPdfWorker/);
  assert.match(pdf, /new Worker\(PDF_WORKER_SRC,\s*\{\s*type:\s*"module"\s*\}\)/);
  assert.doesNotMatch(pdf, /pdfjs-dist\/build\/pdf\.worker\.mjs/);
  assert.match(pdf, /pdfjs\.getDocument/);
  assert.match(pdf, /data:\s*bytes/);
  assert.doesNotMatch(pdf, /url:\s*readerUrl/);
  assert.doesNotMatch(pdf, /disableWorker/);
  assert.match(pdf, /console\.error\("Imported PDF load failed"/);
  assert.match(pdf, /<canvas/);
  assert.match(pdf, /page\.render/);
  assert.match(pdf, /pdfZoom/);
  assert.match(pdf, /calculateAdaptivePdfZoom/);
  assert.match(pdf, /effectivePdfZoom/);
  assert.doesNotMatch(pdf, /PDF_DEFAULT_ZOOM/);
  assert.match(pdf, /data-testid="import-pdf-page-strip"/);
  assert.match(pdf, /overflow-hidden/);
  assert.match(pdf, /getTextContent\(\)/);
  assert.match(pdf, /buildPdfTextLayerItems/);
  assert.match(pdf, /pdfTextLayerItems/);
  assert.match(pdf, /openPdfLookup/);
  assert.match(pdf, /LookupCardStack/);
  assert.match(pdf, /source:\s*\{\s*type:\s*"import"/);
  assert.match(client, /readerUrl/);
  assert.match(client, /fetch\(`\/api\/import\/\$\{documentId\}\/progress`/);
  assert.match(client, /lastPosition:\s*`pdf:\$\{pageNumber\}`/);
  assert.match(client, /unitCount/);
  assert.doesNotMatch(client, /\/pages\?from=/);
  assert.doesNotMatch(client, /lastPageIndex/);
});

test("IMPORT-3 v2 exposes immersive reader controls for original-file rendering", async () => {
  const client = await read("src/app/import/[id]/ImportReaderClient.tsx");

  assert.match(client, /readerChromeVisible,\s*setReaderChromeVisible/);
  assert.match(client, /data-testid="import-reader-chrome"/);
  assert.match(client, /data-testid="import-reader-bottom-chrome"/);
  assert.match(client, /data-testid="import-reader-title-watermark"/);
  assert.match(client, /data-testid="import-reader-page-watermark"/);
  assert.match(client, /href="\/import\/library"/);
  assert.match(client, /handleReaderSurfaceClick/);
  assert.match(client, /zoneRatio <= 0\.25/);
  assert.match(client, /zoneRatio >= 0\.75/);
  assert.match(client, /fixed inset-x-4 bottom-4/);
  assert.match(client, /readerChromeVisible \? "translate-y-0" : "translate-y-\[140%\]"/);
  assert.match(client, /handleReaderTouchStart/);
  assert.match(client, /handleReaderTouchEnd/);
  assert.match(client, /<input[\s\S]*type="range"/);
  assert.match(client, /ExternalLink/);
  assert.doesNotMatch(client, /RefreshCw/);
  assert.match(client, /ChevronLeft/);
  assert.match(client, /ChevronRight/);
  assert.match(client, /canGoPrevious/);
  assert.match(client, /canGoNext/);
  assert.match(client, /kind === "epub"/);
});
