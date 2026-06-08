import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-3 adds an authenticated import library page with designed document states", async () => {
  const pagePath = "src/app/import/library/page.tsx";
  assert.equal(existsSync(pagePath), true, `${pagePath} missing`);

  const source = await read(pagePath);
  assert.match(source, /dynamic\s*=\s*"force-dynamic"/);
  assert.match(source, /getServerSession/);
  assert.match(source, /prisma\.importedDocument\.findMany/);
  assert.match(source, /buildImportedDocumentProgress/);
  assert.match(source, /href=\{`\/import\/\$\{document\.id\}`\}/);
  assert.match(source, /status\s*===\s*"processing"/);
  assert.match(source, /animate-pulse/);
  assert.match(source, /Loader2/);
  assert.match(source, /status\s*===\s*"failed"/);
  assert.match(source, /Trash2/);
  assert.match(source, /border-red-200/);
  assert.match(source, /status\s*===\s*"ready"/);
  assert.match(source, /hover:border-brand-300/);
  assert.match(source, /shadow-card/);
});

test("IMPORT-3 adds an import reader route that restores progress and fetches the initial page window", async () => {
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
  assert.match(page, /initialPageIndex=\{document\.lastPageIndex\}/);
  assert.match(page, /pageCount=\{document\.pageCount\}/);

  const client = await read(clientPath);
  assert.match(client, /"use client"/);
  assert.match(client, /data-testid="import-reader"/);
  assert.match(client, /const WINDOW_RADIUS\s*=\s*5/);
  assert.match(client, /from=\$\{Math\.max\(0,\s*targetPageIndex - WINDOW_RADIUS\)\}/);
  assert.match(client, /to=\$\{Math\.min\(pageCount - 1,\s*targetPageIndex \+ WINDOW_RADIUS\)\}/);
  assert.match(client, /fetch\(`\/api\/import\/\$\{documentId\}\/pages\?from=/);
  assert.match(client, /fetch\(`\/api\/import\/\$\{documentId\}\/progress`/);
  assert.match(client, /lastPageIndex:\s*targetPageIndex/);
  assert.match(client, /LookupCardStack/);
  assert.match(client, /source:\s*\{[\s\S]*type:\s*"lectura"/);
});

test("IMPORT-3 reader exposes the mobile paging dock from the approved design", async () => {
  const client = await read("src/app/import/[id]/ImportReaderClient.tsx");

  assert.match(client, /fixed inset-x-4 bottom-\[calc\(env\(safe-area-inset-bottom\)\+12px\)\]/);
  assert.match(client, /rounded-full border border-zinc-200\/60 bg-white\/80/);
  assert.match(client, /ChevronLeft/);
  assert.match(client, /ChevronRight/);
  assert.match(client, /Aa/);
  assert.match(client, /type="range"/);
  assert.match(client, /accent-brand-500/);
  assert.match(client, /\{currentPageIndex \+ 1\}\s*\/\s*\{pageCount\}/);
});
