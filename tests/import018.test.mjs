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
  assert.match(source, /href=\{`\/import\/\$\{document\.id\}`\}/);
  assert.match(source, /status\s*===\s*"failed"/);
  assert.match(source, /Trash2/);
  assert.match(source, /border-red-200/);
  assert.match(source, /hover:border-brand-300/);
  assert.match(source, /formatSize/);
  assert.match(source, /unitCount/);
  assert.match(source, /lastPosition/);
  assert.doesNotMatch(source, /buildImportedDocumentProgress/);
  assert.doesNotMatch(source, /status\s*===\s*"processing"/);
});

test("IMPORT-3 v2 reader fetches a presigned COS read URL and renders PDFs with pdf.js", async () => {
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
  assert.match(client, /fetch\(`\/api\/import\/\$\{documentId\}\/url`\)/);
  assert.match(client, /setReaderUrl\(`\/api\/import\/\$\{documentId\}\/file`\)/);
  assert.match(client, /await import\("pdfjs-dist\/build\/pdf\.mjs"\)/);
  assert.match(client, /pdfjs\.getDocument/);
  assert.match(client, /disableWorker:\s*true/);
  assert.match(client, /disableRange:\s*true/);
  assert.match(client, /disableStream:\s*true/);
  assert.match(client, /console\.error\("Imported PDF load failed"/);
  assert.match(client, /<canvas/);
  assert.match(client, /page\.render/);
  assert.match(client, /readerUrl/);
  assert.match(client, /fetch\(`\/api\/import\/\$\{documentId\}\/progress`/);
  assert.match(client, /lastPosition:\s*`pdf:\$\{pageNumber\}`/);
  assert.match(client, /unitCount/);
  assert.doesNotMatch(client, /\/pages\?from=/);
  assert.doesNotMatch(client, /lastPageIndex/);
  assert.doesNotMatch(client, /鏃犳硶|娓叉煋|鏂扮獥/);
});

test("IMPORT-3 v2 exposes a compact mobile reader dock for original-file rendering", async () => {
  const client = await read("src/app/import/[id]/ImportReaderClient.tsx");

  assert.match(client, /fixed inset-x-4 bottom-\[calc\(env\(safe-area-inset-bottom\)\+12px\)\]/);
  assert.match(client, /rounded-full border border-zinc-200\/60 bg-white\/90/);
  assert.match(client, /ExternalLink/);
  assert.match(client, /RefreshCw/);
  assert.match(client, /ChevronLeft/);
  assert.match(client, /ChevronRight/);
  assert.match(client, /canGoPrevious/);
  assert.match(client, /canGoNext/);
  assert.match(client, /kind === "epub"/);
  assert.match(client, /epub\.js/);
  assert.match(client, /pdf\.js/);
});
