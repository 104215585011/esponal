import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-4 upload client falls back to same-origin upload when COS direct PUT returns 451", async () => {
  const helperPath = "src/lib/import/upload-client.ts";
  const routePath = "src/app/api/import/upload/route.ts";
  assert.equal(existsSync(helperPath), true, `${helperPath} missing`);
  assert.equal(existsSync(routePath), true, `${routePath} missing`);

  const helper = await read(helperPath);
  assert.match(helper, /class CosUploadError extends Error/);
  assert.match(helper, /request\.status/);
  assert.match(helper, /status === 451/);
  assert.match(helper, /PROXY_UPLOAD_MAX_FILE_BYTES/);
  assert.match(helper, /\/api\/import\/upload/);
  assert.match(helper, /FormData/);

  const route = await read(routePath);
  assert.match(route, /getServerSession\(getAuthOptions\(\)\)/);
  assert.match(route, /request\.formData\(\)/);
  assert.match(route, /MAX_PROXY_UPLOAD_BYTES/);
  assert.match(route, /presignPut/);
  assert.match(route, /fetch\(uploadUrl,\s*\{/);
  assert.match(route, /createImportedDocument/);
  assert.match(route, /sourceStatus/);
});
