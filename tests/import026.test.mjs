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
  assert.match(client, /className="relative h-\[100dvh\] w-screen overflow-hidden bg-\[#f9f9f9\] dark:bg-\[#121212\]"/);

  assert.match(client, /className="relative flex h-\[100dvh\] w-screen touch-pan-y items-start justify-center overflow-auto"/);
  assert.match(client, /onClick=\{handleReaderSurfaceClick\}/);
  assert.match(client, /onTouchStart=\{handleReaderTouchStart\}/);
  assert.match(client, /onTouchEnd=\{handleReaderTouchEnd\}/);
  assert.match(client, /const zoneRatio = \(event\.clientX - rect\.left\) \/ Math\.max\(1, rect\.width\)/);
  assert.match(client, /zoneRatio <= 0\.3/);
  assert.match(client, /zoneRatio >= 0\.7/);

  assert.match(client, /transition-transform duration-300/);
  assert.match(client, /readerChromeVisible \? "translate-y-0" : "-translate-y-full"/);
  assert.match(client, /readerChromeVisible \? "translate-y-0" : "translate-y-full"/);
  assert.match(client, /className=\{`fixed top-0 inset-x-0 h-14 bg-white\/95 backdrop-blur-md border-b border-zinc-200\/50 z-50 flex items-center px-2 shadow-sm transition-transform duration-300/);
  assert.match(client, /className=\{`fixed bottom-0 inset-x-0 bg-white\/95 backdrop-blur-md border-t border-zinc-200\/50 z-50 pb-\[env\(safe-area-inset-bottom\)\] transition-transform duration-300/);
  assert.match(client, /className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-700 active:bg-zinc-100"/);
  assert.match(client, /className="flex-1 truncate text-center text-sm font-bold text-zinc-900 px-4"/);
  assert.match(client, /<input[\s\S]*type="range"/);
  assert.match(client, /className="flex-1 accent-brand-500"/);

  assert.doesNotMatch(client, /rounded-\[28px\] border border-zinc-200\/70 bg-white p-4 shadow-card/);
  assert.doesNotMatch(client, /fixed inset-x-4 bottom-\[calc\(env\(safe-area-inset-bottom\)\+14px\)\] z-50 flex h-\[52px\]/);
  assert.doesNotMatch(client, /rounded-full border border-zinc-200\/60 bg-white\/90 px-2 shadow-elevated backdrop-blur/);
  assert.match(client, /event\.stopPropagation\(\)/);
});
