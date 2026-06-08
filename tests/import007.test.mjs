import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-1 upload route returns a processing document immediately and defers parsing behind the scheduler", async () => {
  const fileRouteSource = await read("src/app/api/import/file/route.ts");

  assert.match(fileRouteSource, /void\s+scheduleImportedDocumentProcessing\(/);
  assert.doesNotMatch(fileRouteSource, /await\s+scheduleImportedDocumentProcessing\(/);
  assert.match(fileRouteSource, /status:\s*document\.status/);
  assert.match(fileRouteSource, /id:\s*document\.id/);
  assert.match(fileRouteSource, /kind:\s*document\.kind/);
  assert.doesNotMatch(fileRouteSource, /settledDocument/);
  assert.doesNotMatch(fileRouteSource, /pageCount:\s*settledDocument\.pageCount/);
});
