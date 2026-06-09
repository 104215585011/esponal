import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT v2 removes server-side parsing and keeps original rendering client-side", async () => {
  assert.equal(existsSync("src/lib/import/parse.ts"), false);
  assert.equal(existsSync("src/lib/import/window.ts"), false);
  assert.equal(existsSync("src/app/api/import/[id]/pages/route.ts"), false);

  const reader = await read("src/app/import/[id]/ImportReaderClient.tsx");
  assert.match(reader, /\/api\/import\/\$\{documentId\}\/url/);
  assert.match(reader, /iframe/);
  assert.match(reader, /getTextContent\(\)/);
  assert.match(reader, /data-testid="import-pdf-text-layer"/);
  assert.match(reader, /LookupCardStack/);
  assert.match(reader, /type: "import"/);
  assert.doesNotMatch(reader, /WINDOW_RADIUS/);
});
