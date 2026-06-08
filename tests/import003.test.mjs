import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-1 v2 presign route validates auth, type, size, and user-scoped COS keys", async () => {
  const source = await read("src/app/api/import/presign/route.ts");

  assert.match(source, /getServerSession\(getAuthOptions\(\)\)/);
  assert.match(source, /unauthorized/);
  assert.match(source, /unsupported_file_type/);
  assert.match(source, /file_too_large/);
  assert.match(source, /kind !== "epub" && kind !== "pdf"/);
  assert.match(source, /MAX_FILE_BYTES\s*=\s*100 \* 1024 \* 1024/);
  assert.match(source, /imports\/\$\{userId\}\/\$\{randomId\}\$\{extension\}/);
  assert.match(source, /presignPut\(\{\s*[\s\S]*key:\s*ossKey[\s\S]*contentType[\s\S]*\}\)/);
});

test("IMPORT-1 v2 document and progress routes persist only owner-scoped metadata", async () => {
  const service = await read("src/lib/import/service.ts");
  const documentRoute = await read("src/app/api/import/document/route.ts");
  const progressRoute = await read("src/app/api/import/[id]/progress/route.ts");
  const documentsRoute = await read("src/app/api/import/documents/route.ts");

  assert.match(service, /export async function createImportedDocument/);
  assert.match(service, /ossKey/);
  assert.match(service, /sizeBytes/);
  assert.match(service, /lastPosition/);
  assert.doesNotMatch(service, /sections/);

  assert.match(documentRoute, /createImportedDocument\(\{\s*[\s\S]*userId[\s\S]*ossKey[\s\S]*sizeBytes[\s\S]*unitCount[\s\S]*\}\)/);
  assert.match(progressRoute, /updateImportedDocumentProgress/);
  assert.match(progressRoute, /lastPosition/);
  assert.match(progressRoute, /unitCount/);
  assert.match(documentsRoute, /listImportedDocumentsForUser\(userId\)/);
  assert.match(service, /where:\s*\{\s*userId\s*\}/);
});
