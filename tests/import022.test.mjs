import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-4 v2 adds the desktop /import page with URL and COS document import surfaces", async () => {
  const pagePath = "src/app/import/page.tsx";
  assert.equal(existsSync(pagePath), true, `${pagePath} missing`);

  const source = await read(pagePath);
  assert.match(source, /dynamic\s*=\s*"force-dynamic"/);
  assert.match(source, /UnifiedImportClient/);

  const client = await read("src/app/import/UnifiedImportClient.tsx");
  assert.match(client, /"use client"/);
  assert.match(client, /\/api\/import\/url/);
  assert.match(client, /router\.push\(payload\.redirect\)/);
  assert.match(client, /uploadImportedDocument/);
  assert.match(client, /onProgress:\s*setUploadProgress/);
  assert.match(client, /router\.push\("\/import\/library"\)/);
  assert.match(client, /统一导入引擎/);
  assert.match(client, /视频链接/);
  assert.match(client, /EPUB\/PDF/);
  assert.match(client, /本地音视频/);
  assert.match(client, /Bilibili 链接/);
  assert.match(client, /即将支持/);
  assert.match(client, /opacity-40 grayscale/);
  assert.match(client, /max-w-2xl mx-auto mt-10 bg-white border border-zinc-200 rounded-\[32px\] p-10 shadow-elevated/);
  assert.doesNotMatch(client, /\/api\/import\/file/);
});

test("IMPORT-4 v2 shared upload helper performs presign, COS PUT, then metadata create", async () => {
  const helperPath = "src/lib/import/upload-client.ts";
  assert.equal(existsSync(helperPath), true, `${helperPath} missing`);

  const source = await read(helperPath);
  assert.match(source, /inferImportKind/);
  assert.match(source, /\/api\/import\/presign/);
  assert.match(source, /XMLHttpRequest/);
  assert.match(source, /request\.open\("PUT", uploadUrl\)/);
  assert.match(source, /request\.upload\.onprogress/);
  assert.match(source, /\/api\/import\/document/);
  assert.match(source, /ossKey/);
  assert.match(source, /sizeBytes/);
});

test("IMPORT-4 v2 adds a reusable mobile ImportSheet with portal, drag close, URL, and COS file modes", async () => {
  const sheetPath = "src/app/components/web/ImportSheet.tsx";
  assert.equal(existsSync(sheetPath), true, `${sheetPath} missing`);

  const source = await read(sheetPath);
  assert.match(source, /createPortal/);
  assert.match(source, /fixed inset-0 z-50 flex flex-col justify-end/);
  assert.match(source, /bg-black\/45 backdrop-blur-sm/);
  assert.match(source, /rounded-t-3xl/);
  assert.match(source, /onPointerDown/);
  assert.match(source, /onPointerUp/);
  assert.match(source, /clientY - dragStartY > 72/);
  assert.match(source, /导入外部视频/);
  assert.match(source, /立即解析视频/);
  assert.match(source, /导入电子书或文档/);
  assert.match(source, /支持 EPUB、PDF \(≤100MB\)/);
  assert.match(source, /navigator\.clipboard\.readText/);
  assert.match(source, /accept="\.epub,\.pdf,application\/epub\+zip,application\/pdf"/);
  assert.match(source, /uploadImportedDocument/);
  assert.match(source, /onProgress:\s*setUploadProgress/);
  assert.doesNotMatch(source, /\/api\/import\/file/);
});

test("IMPORT-4 upgrades the mobile bottom tab bar with a centered import fan-out trigger", async () => {
  const source = await read("src/app/components/web/BottomTabBar.tsx");

  assert.match(source, /ImportSheet/);
  assert.match(source, /Plus/);
  assert.match(source, /Youtube/);
  assert.match(source, /FileText/);
  assert.match(source, /data-testid="mobile-import-trigger"/);
  assert.match(source, /w-12 h-12 rounded-full bg-brand-500 text-white shadow-\[0_8px_16px_-6px_rgba\(16,185,129,0\.5\)\]/);
  assert.match(source, /absolute bottom-20 left-1\/2 -translate-x-1\/2 w-\[calc\(100vw-32px\)\] max-w-sm bg-white rounded-\[24px\]/);
  assert.match(source, /grid grid-cols-2 gap-2/);
  assert.match(source, /瑙嗛閾炬帴|视频链接/);
  assert.match(source, /EPUB\/PDF/);
  assert.match(source, /setSheetMode\("url"\)/);
  assert.match(source, /setSheetMode\("file"\)/);
});
