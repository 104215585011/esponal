import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-1 v2 schema stores COS-backed document metadata without extracted sections", async () => {
  const schema = await read("prisma/schema.prisma");

  assert.match(schema, /importedDocuments\s+ImportedDocument\[\]/);
  assert.match(
    schema,
    /model ImportedDocument \{[\s\S]*userId\s+String[\s\S]*title\s+String[\s\S]*kind\s+ImportKind[\s\S]*ossKey\s+String[\s\S]*sizeBytes\s+Int[\s\S]*unitCount\s+Int\s+@default\(0\)[\s\S]*lastPosition\s+String\s+@default\(""\)[\s\S]*status\s+ImportStatus\s+@default\(ready\)[\s\S]*failReason\s+String\?[\s\S]*@@index\(\[userId, createdAt\]\)[\s\S]*\}/,
  );
  assert.match(schema, /enum ImportKind \{[\s\S]*epub[\s\S]*pdf[\s\S]*\}/);
  assert.match(schema, /enum ImportStatus \{[\s\S]*ready[\s\S]*failed[\s\S]*\}/);
  assert.doesNotMatch(schema, /model DocumentSection/);
  assert.doesNotMatch(schema, /pageCount\s+Int/);
  assert.doesNotMatch(schema, /lastPageIndex\s+Int/);
  assert.doesNotMatch(schema, /sections\s+DocumentSection\[\]/);
});

test("IMPORT-1 v2 exposes COS storage helpers and presign/document/read/progress routes", async () => {
  const paths = [
    "src/lib/storage/cos.ts",
    "src/lib/import/service.ts",
    "src/app/api/import/presign/route.ts",
    "src/app/api/import/document/route.ts",
    "src/app/api/import/documents/route.ts",
    "src/app/api/import/[id]/route.ts",
    "src/app/api/import/[id]/url/route.ts",
    "src/app/api/import/[id]/progress/route.ts",
  ];

  for (const path of paths) {
    assert.equal(existsSync(path), true, `${path} should exist`);
  }

  const cos = await read("src/lib/storage/cos.ts");
  assert.match(cos, /export async function presignPut/);
  assert.match(cos, /export async function presignGet/);
  assert.match(cos, /COS_SECRET_ID/);
  assert.match(cos, /COS_SECRET_KEY/);
  assert.match(cos, /COS_BUCKET/);
  assert.match(cos, /COS_REGION/);

  const presignRoute = await read("src/app/api/import/presign/route.ts");
  assert.match(presignRoute, /MAX_FILE_BYTES\s*=\s*100 \* 1024 \* 1024/);
  assert.match(presignRoute, /presignPut/);
  assert.match(presignRoute, /imports\/\$\{userId\}\//);

  const documentRoute = await read("src/app/api/import/document/route.ts");
  assert.match(documentRoute, /createImportedDocument/);
  assert.match(documentRoute, /ossKey/);
  assert.match(documentRoute, /sizeBytes/);

  const urlRoute = await read("src/app/api/import/[id]/url/route.ts");
  assert.match(urlRoute, /getImportedDocumentByIdForUser/);
  assert.doesNotMatch(urlRoute, /presignGet/);
  assert.match(urlRoute, /\/api\/import\/\$\{context\.params\.id\}\/file/);
});
