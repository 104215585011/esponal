import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-1 v2 migration creates metadata-only ImportedDocument and no DocumentSection table", async () => {
  const migration = await read("prisma/migrations/20260608130000_add_import_documents/migration.sql");

  assert.match(migration, /CREATE TYPE "ImportKind" AS ENUM \('epub', 'pdf'\)/);
  assert.match(migration, /CREATE TYPE "ImportStatus" AS ENUM \('ready', 'failed'\)/);
  assert.match(migration, /"ossKey" TEXT NOT NULL/);
  assert.match(migration, /"sizeBytes" INTEGER NOT NULL/);
  assert.match(migration, /"unitCount" INTEGER NOT NULL DEFAULT 0/);
  assert.match(migration, /"lastPosition" TEXT NOT NULL DEFAULT ''/);
  assert.doesNotMatch(migration, /DocumentSection/);
  assert.doesNotMatch(migration, /pageCount/);
  assert.doesNotMatch(migration, /lastPageIndex/);
});
