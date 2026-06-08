import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-1 scheduler swallows processor failures and logs them instead of leaking route-level rejections", async () => {
  const queueSource = await read("src/lib/import/queue.ts");

  assert.match(queueSource, /try\s*\{/);
  assert.match(queueSource, /processImportedDocumentUpload/);
  assert.match(queueSource, /catch\s*\(error\)/);
  assert.match(queueSource, /console\.error/);
  assert.doesNotMatch(queueSource, /return\s+processImportedDocumentUpload/);
});
