import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-1 page window helpers clamp out-of-range values and keep a valid window", async () => {
  const { clampLastPageIndex, resolvePageWindow } = await import("../src/lib/import/window.ts");

  assert.deepEqual(resolvePageWindow(6, "-3", "99"), {
    from: 0,
    to: 5,
    pageCount: 6,
  });
  assert.deepEqual(resolvePageWindow(6, "4", "1"), {
    from: 4,
    to: 4,
    pageCount: 6,
  });
  assert.deepEqual(resolvePageWindow(0, null, null), {
    from: 0,
    to: 0,
    pageCount: 0,
  });

  assert.equal(clampLastPageIndex(9, 6), 5);
  assert.equal(clampLastPageIndex(2, 6), 2);
  assert.equal(clampLastPageIndex(3, 0), 0);
});

test("IMPORT-1 route contract uses shared window helpers and returns progress-shaped list data", async () => {
  const documentsRoute = await read("src/app/api/import/documents/route.ts");
  const pagesRoute = await read("src/app/api/import/[id]/pages/route.ts");
  const progressRoute = await read("src/app/api/import/[id]/progress/route.ts");
  const progressHelper = await read("src/lib/import/progress.ts");

  assert.match(documentsRoute, /buildImportedDocumentProgress/);
  assert.match(documentsRoute, /progress:\s*buildImportedDocumentProgress\(document\)/);
  assert.match(documentsRoute, /lastPageIndex/);
  assert.match(documentsRoute, /pageCount/);
  assert.match(progressHelper, /currentPage/);
  assert.match(progressHelper, /progressPercent/);

  assert.match(pagesRoute, /resolvePageWindow/);
  assert.match(progressRoute, /clampLastPageIndex/);
});
