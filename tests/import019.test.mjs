import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-3 exposes the import library from the lectura landing page", async () => {
  const source = await read("src/app/lectura/page.tsx");

  assert.match(source, /href="\/import\/library"/);
  assert.match(source, /我的导入库/);
  assert.match(source, /FileText/);
  assert.match(source, /border-brand-200/);
});
