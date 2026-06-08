import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-2 keeps scanned PDF page counts on failed OCR documents for downstream UI messaging", async () => {
  const [serviceSource, processSource] = await Promise.all([
    read("src/lib/import/service.ts"),
    read("src/lib/import/process.ts"),
  ]);

  assert.match(serviceSource, /export async function markImportedDocumentFailed/);
  assert.match(serviceSource, /pageCount\?: number/);
  assert.match(serviceSource, /pageCount:\s*input\.pageCount \?\? 0/);

  assert.match(processSource, /failReason:\s*"ocr_page_limit"[\s\S]*pageCount:\s*error\.pageCount/);
  assert.match(processSource, /failReason:\s*"insufficient_credits"[\s\S]*pageCount:\s*error\.pageCount/);
  assert.match(processSource, /failReason:\s*"ocr_failed"[\s\S]*pageCount:\s*error\.pageCount/);
});
