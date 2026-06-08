import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-1 v2 migration adds COS metadata as an incremental deploy migration", async () => {
  const initialMigration = await read("prisma/migrations/20260608130000_add_import_documents/migration.sql");
  const enumMigration = await read("prisma/migrations/20260608223000_import_cos_v2/migration.sql");
  const migration = await read("prisma/migrations/20260608223100_import_cos_v2_metadata/migration.sql");

  assert.match(initialMigration, /CREATE TYPE "ImportKind" AS ENUM \('epub', 'pdf_text', 'pdf_ocr'\)/);
  assert.match(initialMigration, /CREATE TABLE "DocumentSection"/);
  assert.match(enumMigration, /ALTER TYPE "ImportKind" ADD VALUE IF NOT EXISTS 'pdf'/);
  assert.doesNotMatch(enumMigration, /UPDATE "ImportedDocument"/);
  assert.match(migration, /"ossKey" TEXT/);
  assert.match(migration, /"sizeBytes" INTEGER/);
  assert.match(migration, /"unitCount" INTEGER NOT NULL DEFAULT 0/);
  assert.match(migration, /"lastPosition" TEXT NOT NULL DEFAULT ''/);
  assert.match(migration, /WHERE "kind"::text IN \('pdf_text', 'pdf_ocr'\)/);
  assert.match(migration, /WHERE "status"::text = 'processing'/);
  assert.match(migration, /ALTER COLUMN "status" SET DEFAULT 'ready'/);
});
