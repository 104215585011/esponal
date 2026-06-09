import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-3 fix strips the imported reader chrome for a focused PDF surface", async () => {
  const page = await read("src/app/import/[id]/page.tsx");
  const client = await read("src/app/import/[id]/ImportReaderClient.tsx");

  assert.match(page, /<SiteHeader \/>/);
  assert.match(page, /<section className="mx-auto max-w-app-shell px-4">/);
  assert.doesNotMatch(page, /<header className=/);
  assert.doesNotMatch(page, /Imported Reading/);
  assert.doesNotMatch(page, /py-5|md:py-8/);

  assert.match(client, /className="relative flex min-h-\[calc\(100vh-80px\)\] w-full flex-col"/);
  assert.doesNotMatch(client, /rounded-\[28px\] border border-zinc-200\/70 bg-white p-4 shadow-card/);
  assert.match(client, /className="mb-4 flex items-center justify-between gap-3"/);
  assert.match(client, /className="shrink-0 rounded bg-zinc-100 px-1\.5 py-0\.5 text-\[10px\] font-bold uppercase text-zinc-500"/);
  assert.match(client, /className="truncate text-sm font-semibold text-zinc-900"/);
  assert.doesNotMatch(client, /border-b border-zinc-100 pb-4/);
  assert.doesNotMatch(client, /绗\?\{pageNumber\} \/ \{pageCount\}/);

  assert.match(client, /className="relative flex min-h-\[calc\(100dvh-156px\)\] flex-1 justify-center overflow-hidden rounded-2xl bg-zinc-100\/50"/);
  assert.doesNotMatch(client, /rounded-3xl border border-zinc-200 bg-zinc-50 p-2/);
  assert.doesNotMatch(client, /PDF .*pdf\.js|pdf\.js .*PDF/);

  assert.match(client, /fixed inset-x-4 bottom-\[calc\(env\(safe-area-inset-bottom\)\+12px\)\] z-40 flex h-\[52px\]/);
  assert.match(client, /rounded-full border border-zinc-200\/60 bg-white\/90 px-2 shadow-elevated backdrop-blur/);
  assert.match(client, /className="text-xs font-bold text-zinc-800 font-display"/);
  assert.match(client, /className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-600 active:bg-zinc-100 disabled:opacity-30"/);
});
