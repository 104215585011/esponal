import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-4 upload client falls back to same-origin inline upload when COS direct PUT returns 451", async () => {
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
  assert.match(route, /inlineContent/);
  assert.doesNotMatch(route, /presignPut/);
  assert.doesNotMatch(route, /fetch\(uploadUrl,\s*\{/);
  assert.match(route, /createImportedDocument/);
  assert.doesNotMatch(route, /source_upload_failed/);
});

test("IMPORT-4 inline upload storage is readable by the import file and EPUB APIs", async () => {
  const schema = await read("prisma/schema.prisma");
  assert.match(schema, /inlineContent\s+Bytes\?/);

  const migration = await read("prisma/migrations/20260610093500_add_import_inline_content/migration.sql");
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "inlineContent" BYTEA/);

  const service = await read("src/lib/import/service.ts");
  assert.match(service, /inlineContent\?: Buffer/);
  assert.match(service, /getImportedDocumentFileByIdForUser/);
  assert.match(service, /inlineContent:\s*true/);

  const fileRoute = await read("src/app/api/import/[id]/file/route.ts");
  assert.match(fileRoute, /document\.inlineContent/);
  assert.match(fileRoute, /new Response\(toArrayBuffer\(document\.inlineContent\)/);
  assert.match(fileRoute, /presignGet/);

  const epubRoute = await read("src/app/api/import/[id]/epub/route.ts");
  assert.match(epubRoute, /document\.inlineContent/);
  assert.match(epubRoute, /parseEpubForReader\(document\.inlineContent/);
});
