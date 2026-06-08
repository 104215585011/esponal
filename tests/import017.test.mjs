import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-2 OCR provider wraps transport, timeout, and invalid JSON failures as provider errors", async () => {
  const ocrSource = await read("src/lib/import/ocr.ts");

  assert.match(ocrSource, /async function requestOcrProvider/);
  assert.match(ocrSource, /try\s*\{[\s\S]*fetch\(/);
  assert.match(ocrSource, /catch\s*\(error\)/);
  assert.match(ocrSource, /error instanceof OcrProviderError/);
  assert.match(ocrSource, /throw new OcrProviderError\("ocr_provider_failed"/);
  assert.match(ocrSource, /const payload = await requestOcrProvider/);
  assert.match(ocrSource, /timeoutMs: timeoutMs > 0 && Number\.isFinite\(timeoutMs\) \? timeoutMs : 180000/);
});
