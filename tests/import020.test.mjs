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

  const client = await read("src/app/import/[id]/ImportReaderClient.tsx");
  const pdf = await read("src/app/import/[id]/PdfReader.tsx");
  assert.match(client, /\/api\/import\/\$\{documentId\}\/file/);
  assert.doesNotMatch(client, /\/api\/import\/\$\{documentId\}\/url/);
  assert.doesNotMatch(client, /iframe/);
  assert.match(pdf, /getTextContent\(\)/);
  assert.match(pdf, /data-testid="import-pdf-text-layer"/);
  assert.match(pdf, /LookupCardStack/);
  assert.match(pdf, /type: "import"/);
  assert.doesNotMatch(client + pdf, /WINDOW_RADIUS/);
});
