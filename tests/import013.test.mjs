import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-2 parse layer records scanned PDF page count and exposes an OCR recovery path", async () => {
  const parseSource = await read("src/lib/import/parse.ts");

  assert.match(parseSource, /class NeedsOcrError/);
  assert.match(parseSource, /readonly pageCount:\s*number/);
  assert.match(parseSource, /constructor\(pageCount:\s*number/);
  assert.match(parseSource, /throw new NeedsOcrError\(document\.numPages\)/);
  assert.match(parseSource, /export async function parseImportedDocumentWithOcr/);
  assert.match(parseSource, /runOcr/);
  assert.match(parseSource, /kind:\s*"pdf_ocr"/);
});
