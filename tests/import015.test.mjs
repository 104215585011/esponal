import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-2 processor collapses provider-side OCR failures into ocr_failed without charging text imports", async () => {
  const processSource = await read("src/lib/import/process.ts");

  assert.match(processSource, /import\s+\{\s*OcrPageLimitError,\s*OcrProviderError,\s*OCR_PAGE_LIMIT\s*\}/);
  assert.match(processSource, /ocrError instanceof OcrProviderError/);
  assert.match(processSource, /failReason:\s*"ocr_failed"/);
  assert.match(processSource, /const parsed = await parseImportedDocument\(input\.file\)/);
  assert.match(processSource, /return markImportedDocumentReady\(\{\s*[\s\S]*kind:\s*parsed\.kind[\s\S]*\}\);/);
  assert.match(processSource, /const parsed = await parseImportedDocumentWithOcr\(input\.file\)/);
  assert.match(processSource, /const spendResult = await spendCredits/);
});
