import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-3 reader uses the approved fullscreen app-style V2 chrome", async () => {
  const page = await read("src/app/import/[id]/page.tsx");
  const client = await read("src/app/import/[id]/ImportReaderClient.tsx");

  assert.doesNotMatch(page, /<SiteHeader \/>/);
  assert.doesNotMatch(page, /max-w-app-shell/);
  assert.doesNotMatch(page, /<header className=/);
  assert.doesNotMatch(page, /Imported Reading/);
  assert.doesNotMatch(page, /py-5|md:py-8|pb-24|min-h-screen/);
  assert.match(page, /className="h-\[100dvh\] w-screen overflow-hidden bg-\[#f9f9f9\] dark:bg-\[#121212\]"/);

  assert.match(client, /readerChromeVisible,\s*setReaderChromeVisible/);
  assert.match(client, /handleReaderSurfaceClick/);
  assert.match(client, /showReaderChrome/);
  assert.match(client, /handleReaderTouchStart/);
  assert.match(client, /handleReaderTouchEnd/);
  assert.match(client, /href="\/import\/library"/);
  assert.match(client, /data-testid="import-reader-chrome"/);
  assert.match(client, /data-testid="import-reader-bottom-chrome"/);
  assert.match(client, /data-testid="import-reader-title-watermark"/);
  assert.match(client, /data-testid="import-reader-page-watermark"/);
  assert.match(client, /PAPER_CLASS/);
  assert.match(client, /data-testid="import-reader"/);

  assert.match(client, /className="relative h-\[100dvh\] w-screen touch-pan-y overflow-hidden"/);
  assert.match(client, /onClick=\{handleReaderSurfaceClick\}/);
  assert.match(client, /onTouchStart=\{handleReaderTouchStart\}/);
  assert.match(client, /onTouchEnd=\{handleReaderTouchEnd\}/);
  assert.match(client, /const zoneRatio = \(event\.clientX - rect\.left\) \/ Math\.max\(1, rect\.width\)/);
  assert.match(client, /zoneRatio <= 0\.25/);
  assert.match(client, /zoneRatio >= 0\.75/);

  assert.match(client, /transition-transform duration-300/);
  assert.match(client, /readerChromeVisible \? "translate-y-0" : "-translate-y-full"/);
  assert.match(client, /readerChromeVisible \? "translate-y-0" : "translate-y-\[140%\]"/);
  assert.match(client, /className=\{`fixed inset-x-0 top-0 z-50 flex h-14/);
  assert.match(client, /className=\{`fixed inset-x-4 bottom-4 z-50 rounded-full/);
  assert.match(client, /aria-label="退出阅读器"/);
  assert.match(client, /className="flex-1 truncate text-center text-sm font-bold"/);
  assert.match(client, /<input[\s\S]*type="range"/);
  assert.match(client, /className="flex-1 accent-brand-500"/);

  assert.doesNotMatch(client, /rounded-\[28px\] border border-zinc-200\/70 bg-white p-4 shadow-card/);
  assert.doesNotMatch(client, /fixed inset-x-4 bottom-\[calc\(env\(safe-area-inset-bottom\)\+14px\)\] z-50 flex h-\[52px\]/);
  assert.doesNotMatch(client, /rounded-full border border-zinc-200\/60 bg-white\/90 px-2 shadow-elevated backdrop-blur/);
  assert.match(client, /event\.stopPropagation\(\)/);
});
