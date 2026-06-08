import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-1 upload flow creates a processing document before settling ready or failed", async () => {
  const serviceSource = await read("src/lib/import/service.ts");
  const processSource = await read("src/lib/import/process.ts");
  const queueSource = await read("src/lib/import/queue.ts");
  const fileRouteSource = await read("src/app/api/import/file/route.ts");

  assert.match(serviceSource, /export async function markImportedDocumentReady/);
  assert.match(serviceSource, /export async function markImportedDocumentFailed/);
  assert.match(serviceSource, /deleteMany:\s*\{\s*documentId:/);
  assert.match(serviceSource, /status:\s*"ready"/);
  assert.match(serviceSource, /status:\s*"failed"/);

  assert.match(fileRouteSource, /createImportedDocument\(\{\s*[\s\S]*status:\s*"processing"/);
  assert.match(fileRouteSource, /scheduleImportedDocumentProcessing/);
  assert.match(queueSource, /processImportedDocumentUpload/);
  assert.match(processSource, /markImportedDocumentReady/);
  assert.match(processSource, /markImportedDocumentFailed/);
  assert.match(processSource, /NeedsOcrError/);
  assert.match(processSource, /parseImportedDocumentWithOcr|ocr_failed|ocr_page_limit/);
});

test("IMPORT-1 status route returns reader metadata without leaking section bodies", async () => {
  const serviceSource = await read("src/lib/import/service.ts");
  const statusRouteSource = await read("src/app/api/import/[id]/route.ts");

  assert.match(serviceSource, /select:\s*\{/);
  assert.match(serviceSource, /title:\s*true/);
  assert.match(serviceSource, /kind:\s*true/);
  assert.match(serviceSource, /status:\s*true/);
  assert.match(serviceSource, /failReason:\s*true/);
  assert.match(serviceSource, /pageCount:\s*true/);
  assert.match(serviceSource, /lastPageIndex:\s*true/);
  assert.doesNotMatch(serviceSource, /sections:\s*true/);
  assert.match(statusRouteSource, /getImportedDocumentByIdForUser/);
});
