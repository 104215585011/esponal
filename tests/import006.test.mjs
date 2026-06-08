import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-1 exposes a scheduling adapter between upload routes and document processing", async () => {
  const queuePath = "src/lib/import/queue.ts";
  assert.equal(existsSync(queuePath), true, `${queuePath} missing`);

  const queueSource = await read(queuePath);
  assert.match(queueSource, /export async function scheduleImportedDocumentProcessing/);
  assert.match(queueSource, /processImportedDocumentUpload/);
});

test("IMPORT-1 upload route delegates through the scheduling adapter instead of coupling directly to the processor", async () => {
  const fileRouteSource = await read("src/app/api/import/file/route.ts");

  assert.match(fileRouteSource, /scheduleImportedDocumentProcessing/);
  assert.match(fileRouteSource, /documentId:\s*document\.id/);
  assert.doesNotMatch(fileRouteSource, /processImportedDocumentUpload/);
});
