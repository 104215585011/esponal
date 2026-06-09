import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-3 serves the pdf.js module worker through a same-origin route", async () => {
  const routePath = "src/app/api/import/pdf-worker/route.ts";
  assert.equal(existsSync(routePath), true, `${routePath} missing`);

  const route = await read(routePath);
  assert.match(route, /runtime\s*=\s*"nodejs"/);
  assert.match(route, /"pdfjs-dist",\s*"build",\s*"pdf\.worker\.min\.mjs"/);
  assert.match(route, /readFile/);
  assert.match(route, /["']content-type["']:\s*"text\/javascript; charset=utf-8"/);
  assert.match(route, /["']cache-control["']:\s*"public, max-age=31536000, immutable"/);

  const client = await read("src/app/import/[id]/ImportReaderClient.tsx");
  assert.match(client, /GlobalWorkerOptions\.workerSrc\s*=\s*"\/api\/import\/pdf-worker"/);
  assert.doesNotMatch(client, /new URL\(\s*"pdfjs-dist\/build\/pdf\.worker/);
});
