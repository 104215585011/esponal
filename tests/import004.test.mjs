import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-1 v2 removes server-side document extraction and OCR from Phase 1", async () => {
  const forbiddenPaths = [
    "src/lib/import/parse.ts",
    "src/lib/import/paginate.ts",
    "src/lib/import/process.ts",
    "src/lib/import/queue.ts",
    "src/lib/import/ocr.ts",
    "src/app/api/import/file/route.ts",
    "src/app/api/import/[id]/pages/route.ts",
  ];

  for (const path of forbiddenPaths) {
    await assert.rejects(() => read(path), /ENOENT/, `${path} should be removed in v2`);
  }

  const progress = await read("src/app/api/import/[id]/progress/route.ts");
  assert.doesNotMatch(progress, /lastPageIndex/);
  assert.doesNotMatch(progress, /buildImportedDocumentProgress/);
});
