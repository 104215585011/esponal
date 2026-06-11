import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT v2 serves imported files through an authenticated same-origin proxy", async () => {
  const routePath = "src/app/api/import/[id]/file/route.ts";
  assert.equal(existsSync(routePath), true, `${routePath} missing`);

  const source = await read(routePath);
  assert.match(source, /getServerSession\(getAuthOptions\(\)\)/);
  assert.match(source, /getImportedDocumentFileByIdForUser\(userId,\s*context\.params\.id\)/);
  assert.match(source, /presignGet\(\{\s*key:\s*document\.ossKey\s*\}\)/);
  assert.doesNotMatch(source, /responseContentDisposition/);
  assert.doesNotMatch(source, /responseContentType/);
  assert.match(source, /request\.headers\.get\("range"\)/);
  assert.match(source, /await fetch\(url,\s*\{\s*cache:\s*"no-store",\s*headers:\s*rangeHeader \? \{\s*Range:\s*rangeHeader\s*\} : undefined\s*\}\)/);
  assert.match(source, /upstream\.headers\.get\("content-type"\)/);
  assert.match(source, /upstream\.headers\.get\("content-length"\)/);
  assert.match(source, /upstream\.headers\.get\("content-range"\)/);
  assert.match(source, /sourceStatus:\s*upstream\.status/);
  assert.match(source, /new Response\(upstream\.body/);
  assert.match(source, /"Accept-Ranges":\s*"bytes"/);
  assert.match(source, /"Content-Range"/);
  assert.match(source, /"Content-Disposition":\s*"inline"/);
  assert.match(source, /"Content-Type":\s*contentType/);
  assert.match(source, /"Cache-Control":\s*"private, no-store"/);
});

test("IMPORT v2 legacy URL route never exposes direct COS links to readers", async () => {
  const routePath = "src/app/api/import/[id]/url/route.ts";
  assert.equal(existsSync(routePath), true, `${routePath} missing`);

  const source = await read(routePath);
  assert.match(source, /getServerSession\(getAuthOptions\(\)\)/);
  assert.match(source, /getImportedDocumentByIdForUser\(userId,\s*context\.params\.id\)/);
  assert.doesNotMatch(source, /presignGet/);
  assert.match(source, /NextResponse\.json\(\{\s*url:\s*`\/api\/import\/\$\{context\.params\.id\}\/file`/);
  assert.doesNotMatch(source, /responseContentDisposition/);
  assert.doesNotMatch(source, /responseContentType/);
});
