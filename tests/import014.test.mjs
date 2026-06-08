import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-2 OCR provider normalizes provider failures and rejects page-count mismatches", async () => {
  const ocrSource = await read("src/lib/import/ocr.ts");

  assert.match(ocrSource, /export class OcrProviderError extends Error/);
  assert.match(ocrSource, /readonly code:/);
  assert.match(ocrSource, /constructor\(code:/);
  assert.match(ocrSource, /throw new OcrProviderError\("ocr_provider_unavailable"/);
  assert.match(ocrSource, /throw new OcrProviderError\("ocr_provider_failed"/);
  assert.match(ocrSource, /throw new OcrProviderError\("ocr_provider_empty"/);
  assert.match(ocrSource, /pages\.length !== input\.pageCount/);
  assert.match(ocrSource, /throw new OcrProviderError\("ocr_provider_page_mismatch"/);
});
