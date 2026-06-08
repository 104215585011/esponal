import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-1 progress update route returns the shared progress shape after clamping", async () => {
  const progressRouteSource = await read("src/app/api/import/[id]/progress/route.ts");
  const progressHelperSource = await read("src/lib/import/progress.ts");

  assert.match(progressRouteSource, /buildImportedDocumentProgress/);
  assert.match(progressRouteSource, /progress:\s*buildImportedDocumentProgress/);
  assert.match(progressRouteSource, /lastPageIndex/);
  assert.match(progressHelperSource, /progressPercent/);
});
