import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-1 has a dedicated document processor that can later move behind an async adapter", async () => {
  const processPath = "src/lib/import/process.ts";
  assert.equal(existsSync(processPath), true, `${processPath} missing`);

  const processSource = await read(processPath);
  assert.match(processSource, /export async function processImportedDocumentUpload/);
  assert.match(processSource, /parseImportedDocument/);
  assert.match(processSource, /markImportedDocumentReady/);
  assert.match(processSource, /markImportedDocumentFailed/);
  assert.match(processSource, /NeedsOcrError/);
  assert.match(processSource, /parseImportedDocumentWithOcr/);
  assert.match(processSource, /failReason:\s*"ocr_failed"/);
  assert.match(processSource, /failReason:\s*"import_failed"/);
});

test("IMPORT-1 upload route delegates settled processing to the shared processor after creating processing state", async () => {
  const queueSource = await read("src/lib/import/queue.ts");
  const fileRouteSource = await read("src/app/api/import/file/route.ts");

  assert.match(fileRouteSource, /createImportedDocument\(\{\s*[\s\S]*status:\s*"processing"/);
  assert.match(fileRouteSource, /scheduleImportedDocumentProcessing/);
  assert.match(fileRouteSource, /documentId:\s*document\.id/);
  assert.match(queueSource, /processImportedDocumentUpload/);
  assert.doesNotMatch(fileRouteSource, /markImportedDocumentReady/);
  assert.doesNotMatch(fileRouteSource, /markImportedDocumentFailed/);
});
