import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-1 upload route validates MIME type alongside supported import extensions", async () => {
  const fileRouteSource = await read("src/app/api/import/file/route.ts");

  assert.match(fileRouteSource, /ALLOWED_MIME_TYPES/);
  assert.match(fileRouteSource, /application\/epub\+zip/);
  assert.match(fileRouteSource, /application\/pdf/);
  assert.match(fileRouteSource, /hasAllowedMimeType\(fileValue\)/);
  assert.match(fileRouteSource, /file\.type/);
  assert.match(fileRouteSource, /unsupported file type/);
});
