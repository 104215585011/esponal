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
  assert.match(source, /getImportedDocumentByIdForUser\(userId,\s*context\.params\.id\)/);
  assert.match(source, /presignGet\(\{\s*[\s\S]*key:\s*document\.ossKey[\s\S]*responseContentDisposition:\s*"inline"[\s\S]*responseContentType:\s*contentType[\s\S]*\}\)/);
  assert.match(source, /await fetch\(url,\s*\{\s*cache:\s*"no-store"\s*\}\)/);
  assert.match(source, /new Response\(upstream\.body/);
  assert.match(source, /"Content-Disposition":\s*"inline"/);
  assert.match(source, /"Content-Type":\s*contentType/);
  assert.match(source, /"Cache-Control":\s*"private, no-store"/);
});
