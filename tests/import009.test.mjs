import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-1 status route returns the same progress shape used by the documents list", async () => {
  const statusRouteSource = await read("src/app/api/import/[id]/route.ts");
  const progressHelperSource = await read("src/lib/import/progress.ts");
  const serviceSource = await read("src/lib/import/service.ts");

  assert.match(statusRouteSource, /buildImportedDocumentProgress/);
  assert.match(statusRouteSource, /progress:\s*buildImportedDocumentProgress\(document\)/);
  assert.match(serviceSource, /lastPageIndex:\s*true/);
  assert.match(serviceSource, /pageCount:\s*true/);
  assert.match(progressHelperSource, /currentPage/);
  assert.match(progressHelperSource, /progressPercent/);
});
