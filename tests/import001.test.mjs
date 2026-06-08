import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-1 schema: imported documents and sections are modeled on User", async () => {
  const schema = await read("prisma/schema.prisma");

  assert.match(schema, /importedDocuments\s+ImportedDocument\[\]/);
  assert.match(
    schema,
    /model ImportedDocument \{[\s\S]*userId\s+String[\s\S]*title\s+String[\s\S]*kind\s+ImportKind[\s\S]*status\s+ImportStatus\s+@default\(processing\)[\s\S]*failReason\s+String\?[\s\S]*pageCount\s+Int\s+@default\(0\)[\s\S]*lastPageIndex\s+Int\s+@default\(0\)[\s\S]*sections\s+DocumentSection\[\][\s\S]*\}/,
  );
  assert.match(
    schema,
    /model DocumentSection \{[\s\S]*documentId\s+String[\s\S]*pageIndex\s+Int[\s\S]*content\s+String[\s\S]*@@unique\(\[documentId, pageIndex\]\)[\s\S]*\}/,
  );
  assert.match(
    schema,
    /enum ImportKind \{[\s\S]*epub[\s\S]*pdf_text[\s\S]*pdf_ocr[\s\S]*\}/,
  );
  assert.match(
    schema,
    /enum ImportStatus \{[\s\S]*processing[\s\S]*ready[\s\S]*failed[\s\S]*\}/,
  );
});

test("IMPORT-1 exposes paginate and parse helpers for document ingestion", async () => {
  const paginatePath = "src/lib/import/paginate.ts";
  const parsePath = "src/lib/import/parse.ts";

  assert.equal(existsSync(paginatePath), true, `${paginatePath} missing`);
  assert.equal(existsSync(parsePath), true, `${parsePath} missing`);

  const paginateSource = await read(paginatePath);
  assert.match(paginateSource, /export function paginateImportedText/);
  assert.match(paginateSource, /targetCharsPerPage/);
  assert.match(paginateSource, /2500/);

  const parseSource = await read(parsePath);
  assert.match(parseSource, /NeedsOcrError/);
  assert.match(parseSource, /export async function parseImportedDocument/);
  assert.match(parseSource, /epub|pdf/i);
});

test("IMPORT-1 import routes exist for upload, status, pages, list, and progress", async () => {
  const requiredPaths = [
    "src/app/api/import/file/route.ts",
    "src/app/api/import/documents/route.ts",
    "src/app/api/import/[id]/route.ts",
    "src/app/api/import/[id]/pages/route.ts",
    "src/app/api/import/[id]/progress/route.ts",
  ];

  for (const routePath of requiredPaths) {
    assert.equal(existsSync(routePath), true, `${routePath} missing`);
  }

  const fileRoute = await read("src/app/api/import/file/route.ts");
  assert.match(fileRoute, /getServerSession/);
  assert.match(fileRoute, /getAuthOptions/);
  assert.match(fileRoute, /formData/);
  assert.match(fileRoute, /ImportedDocument|createImportedDocument|parseImportedDocument/);

  const pagesRoute = await read("src/app/api/import/[id]/pages/route.ts");
  assert.match(pagesRoute, /searchParams/);
  assert.match(pagesRoute, /from/);
  assert.match(pagesRoute, /to/);

  const progressRoute = await read("src/app/api/import/[id]/progress/route.ts");
  assert.match(progressRoute, /lastPageIndex/);
});
