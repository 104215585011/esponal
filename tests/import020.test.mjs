import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT build compatibility resolves pdfjs standard fonts without a bundled node_modules URL", async () => {
  const source = await read("src/lib/import/parse.ts");

  assert.match(source, /createRequire/);
  assert.match(source, /require\.resolve\("pdfjs-dist\/package\.json"\)/);
  assert.match(source, /join\(dirname\(.*pdfjsPackagePath.*\),\s*"standard_fonts"\)/s);
  assert.doesNotMatch(source, /new URL\(".*node_modules\/pdfjs-dist\/standard_fonts/);
});
