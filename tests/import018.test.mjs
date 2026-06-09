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
  assert.match(source, /导入失败/);
  assert.match(source, /PDF 文件/);
  assert.match(source, /EPUB 文件/);
  assert.match(source, /href=\{`\/import\/\$\{document\.id\}`\}/);
  assert.match(source, /status\s*===\s*"failed"/);
  assert.match(source, /ImportDeleteButton/);
  assert.match(source, /border-red-200/);
  assert.match(source, /hover:border-brand-300/);
  assert.match(source, /formatSize/);
  assert.match(source, /unitCount/);
  assert.match(source, /lastPosition/);
  assert.doesNotMatch(source, /鎴戠殑|瀵煎叆|闃呰|澶辫触/);
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
  assert.match(source, /aria-label=\{`删除 \${title}`\}/);
  assert.match(source, /Trash2/);
});

test("IMPORT-3 v2 reader fetches original PDF bytes before rendering with pdf.js", async () => {
  const pagePath = "src/app/import/[id]/page.tsx";
  const clientPath = "src/app/import/[id]/ImportReaderClient.tsx";
  assert.equal(existsSync(pagePath), true, `${pagePath} missing`);
  assert.equal(existsSync(clientPath), true, `${clientPath} missing`);

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
  assert.match(client, /"use client"/);
  assert.match(client, /data-testid="import-reader"/);
  assert.match(client, /setReaderUrl\(`\/api\/import\/\$\{documentId\}\/file`\)/);
  assert.doesNotMatch(client, /fetch\(`\/api\/import\/\$\{documentId\}\/url`\)/);
  assert.doesNotMatch(client, /src=\{readerUrl\}/);
  assert.match(client, /EPUB 阅读器正在接入/);
  assert.match(client, /href=\{readerUrl\}/);
  assert.match(client, /await fetch\(readerUrl,\s*\{\s*cache:\s*"no-store",\s*credentials:\s*"same-origin"\s*\}\)/);
  assert.match(client, /await response\.arrayBuffer\(\)/);
  assert.match(client, /new Uint8Array\(buffer\)/);
  assert.match(client, /await import\("pdfjs-dist\/build\/pdf\.mjs"\)/);
  assert.match(client, /configurePdfJsWorker\(pdfjs\)/);
  assert.match(client, /const PDF_WORKER_SRC\s*=\s*"\/api\/import\/pdf-worker"/);
  assert.match(client, /pdfjs\.GlobalWorkerOptions\.workerSrc\s*=\s*PDF_WORKER_SRC/);
  assert.match(client, /pdfjs\.GlobalWorkerOptions\.workerPort\s*=\s*sharedPdfWorker/);
  assert.match(client, /new Worker\(PDF_WORKER_SRC,\s*\{\s*type:\s*"module"\s*\}\)/);
  assert.doesNotMatch(client, /pdfjs-dist\/build\/pdf\.worker\.mjs/);
  assert.match(client, /pdfjs\.getDocument/);
  assert.match(client, /data:\s*bytes/);
  assert.doesNotMatch(client, /url:\s*readerUrl/);
  assert.doesNotMatch(client, /disableWorker/);
  assert.match(client, /console\.error\("Imported PDF load failed"/);
  assert.match(client, /<canvas/);
  assert.match(client, /page\.render/);
  assert.match(client, /pdfZoom/);
  assert.match(client, /calculateAdaptivePdfZoom/);
  assert.match(client, /effectivePdfZoom/);
  assert.doesNotMatch(client, /PDF_DEFAULT_ZOOM/);
  assert.match(client, /overflow-x-auto/);
  assert.match(client, /getTextContent\(\)/);
  assert.match(client, /buildPdfTextLayerItems/);
  assert.match(client, /pdfTextLayerItems/);
  assert.match(client, /openPdfLookup/);
  assert.match(client, /LookupCardStack/);
  assert.match(client, /source:\s*\{\s*type:\s*"import"/);
  assert.match(client, /readerUrl/);
  assert.match(client, /fetch\(`\/api\/import\/\$\{documentId\}\/progress`/);
  assert.match(client, /lastPosition:\s*`pdf:\$\{pageNumber\}`/);
  assert.match(client, /unitCount/);
  assert.doesNotMatch(client, /\/pages\?from=/);
  assert.doesNotMatch(client, /lastPageIndex/);
  assert.doesNotMatch(client, /鏃犳硶|娓叉煋|鏂扮獥/);
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
  assert.match(client, /zoneRatio <= 0\.3/);
  assert.match(client, /zoneRatio >= 0\.7/);
  assert.match(client, /fixed bottom-0 inset-x-0 bg-white\/95/);
  assert.match(client, /readerChromeVisible \? "translate-y-0" : "translate-y-full"/);
  assert.match(client, /handleReaderTouchStart/);
  assert.match(client, /handleReaderTouchEnd/);
  assert.match(client, /<input[\s\S]*type="range"/);
  assert.match(client, /ExternalLink/);
  assert.match(client, /RefreshCw/);
  assert.match(client, /ChevronLeft/);
  assert.match(client, /ChevronRight/);
  assert.match(client, /canGoPrevious/);
  assert.match(client, /canGoNext/);
  assert.match(client, /kind === "epub"/);
  assert.doesNotMatch(client, /epub\.js 待接入|pdf\.js/);
});
