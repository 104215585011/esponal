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
  assert.match(source, /href="\/vocab"/);
  assert.match(source, /返回语料库/);
  assert.match(source, /href="\/import\/library"/);
  assert.match(source, /我的导入库/);
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

test("IMPORT-4 → MOBILE-R2: the global import fan-out lives in the shell top bar", async () => {
  const source = await read("src/app/components/shell/AppShell.tsx");

  // 位置从底栏中央挪到顶栏右侧,但两个入口都在
  assert.ok(source.includes("ImportSheet"));
  assert.ok(source.includes("data-testid=\"mobile-import-trigger\""));
  assert.ok(source.includes("aria-label=\"导入\""));
  assert.ok(source.includes("grid grid-cols-2 gap-2"));
  assert.ok(source.includes("视频链接"));
  assert.ok(source.includes("EPUB/PDF"));
  assert.ok(source.includes("setSheetMode(\"url\")"));
  assert.ok(source.includes("setSheetMode(\"file\")"));
  // 浮层随路由变化收起,不能跨页残留
  assert.ok(source.includes("setFanOpen(false)"));
});
