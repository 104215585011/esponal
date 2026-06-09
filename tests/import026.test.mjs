import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-3 reader uses immersive book-style chrome that appears on tap", async () => {
  const page = await read("src/app/import/[id]/page.tsx");
  const client = await read("src/app/import/[id]/ImportReaderClient.tsx");

  assert.doesNotMatch(page, /<SiteHeader \/>/);
  assert.doesNotMatch(page, /max-w-app-shell/);
  assert.doesNotMatch(page, /<header className=/);
  assert.doesNotMatch(page, /Imported Reading/);
  assert.doesNotMatch(page, /py-5|md:py-8|pb-24/);

  assert.match(client, /readerChromeVisible,\s*setReaderChromeVisible/);
  assert.match(client, /toggleReaderChrome/);
  assert.match(client, /showReaderChrome/);
  assert.match(client, /handleReaderTouchStart/);
  assert.match(client, /handleReaderTouchEnd/);
  assert.match(client, /href="\/import\/library"/);
  assert.match(client, /data-testid="import-reader-chrome"/);
  assert.match(client, /aria-label="退出阅读器"/);
  assert.match(client, /aria-label="显示或隐藏阅读控件"/);
  assert.match(client, /className="relative min-h-\[100dvh\] w-full overflow-hidden bg-\[#f6f4ef\]"/);
  assert.doesNotMatch(client, /rounded-\[28px\] border border-zinc-200\/70 bg-white p-4 shadow-card/);
  assert.doesNotMatch(client, /className="mb-4 flex items-center justify-between gap-3"/);
  assert.match(client, /className="shrink-0 rounded bg-zinc-100 px-1\.5 py-0\.5 text-\[10px\] font-bold uppercase text-zinc-500"/);
  assert.match(client, /className="truncate text-sm font-semibold text-zinc-900"/);
  assert.doesNotMatch(client, /border-b border-zinc-100 pb-4/);

  assert.match(client, /className="relative flex h-\[100dvh\] w-full touch-pan-y items-start justify-center overflow-auto"/);
  assert.match(client, /onClick=\{toggleReaderChrome\}/);
  assert.match(client, /onTouchStart=\{handleReaderTouchStart\}/);
  assert.match(client, /onTouchEnd=\{handleReaderTouchEnd\}/);
  assert.doesNotMatch(client, /rounded-3xl border border-zinc-200 bg-zinc-50 p-2/);
  assert.doesNotMatch(client, /PDF .*pdf\.js|pdf\.js .*PDF/);

  assert.match(client, /pointer-events-none opacity-0/);
  assert.match(client, /readerChromeVisible \? "pointer-events-auto opacity-100"/);
  assert.doesNotMatch(client, /fixed inset-x-4 bottom-\[calc\(env\(safe-area-inset-bottom\)\+12px\)\] z-40 flex h-\[52px\]/);
  assert.match(client, /rounded-full border border-zinc-200\/60 bg-white\/90 px-2 shadow-elevated backdrop-blur/);
  assert.match(client, /className="text-xs font-bold text-zinc-800 font-display"/);
  assert.match(client, /className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-600 active:bg-zinc-100 disabled:opacity-30"/);
  assert.match(client, /event\.stopPropagation\(\)/);
});
