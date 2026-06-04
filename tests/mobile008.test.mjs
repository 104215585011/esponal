// Timestamp: 2026-06-04 14:48
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const readText = (filePath) => readFile(filePath, "utf8");

test("MOBILE-008 grammar pages reserve mobile safe-area space and keep desktop sidebars isolated", async () => {
  const listPage = await readText("src/app/grammar/page.tsx");
  const detailPage = await readText("src/app/grammar/[slug]/page.tsx");

  assert.match(listPage, /mx-auto flex w-full max-w-5xl gap-8 px-4 pt-5 pb-\[calc\(3\.5rem\+env\(safe-area-inset-bottom\)\+16px\)\] sm:px-8 md:py-8/);
  assert.match(detailPage, /mx-auto flex w-full max-w-5xl gap-8 px-4 pt-5 pb-\[calc\(3\.5rem\+env\(safe-area-inset-bottom\)\+16px\)\] sm:px-8 md:py-8/);
  assert.match(listPage, /hidden w-\[220px\] shrink-0 lg:block/);
  assert.match(detailPage, /hidden w-\[220px\] shrink-0 lg:block/);
  assert.match(listPage, /mb-5 lg:hidden/);
  assert.match(detailPage, /mb-5 md:mb-6 lg:hidden/);
});

test("MOBILE-008 grammar mobile list and detail use compact zinc surfaces and table scroll guidance", async () => {
  const listPage = await readText("src/app/grammar/page.tsx");
  const detailPage = await readText("src/app/grammar/[slug]/page.tsx");

  assert.match(listPage, /mb-5 lg:hidden/);
  assert.match(listPage, /text-2xl leading-snug md:text-3xl/);
  assert.match(listPage, /flex flex-col gap-2\.5 md:gap-3/);
  assert.match(listPage, /rounded-card border border-zinc-200\/50/);
  assert.match(listPage, /p-4 shadow-sm transition-transform active:scale-\[0\.99\]/);
  assert.match(listPage, /line-clamp-2 md:line-clamp-none/);
  assert.doesNotMatch(listPage, /border-gray-/);

  assert.match(detailPage, /mt-4 mb-6/);
  assert.match(detailPage, /text-2xl leading-snug md:text-3xl/);
  assert.match(detailPage, /flex items-baseline justify-between gap-3/);
  assert.match(detailPage, /md:hidden/);
  assert.match(detailPage, /overflow-x-auto rounded-xl border border-zinc-200\/50/);
  assert.match(detailPage, /bg-zinc-50 dark:bg-zinc-800\/50/);
  assert.match(detailPage, /border-zinc-100 dark:border-zinc-800\/80/);
  assert.match(detailPage, /grid gap-3 sm:grid-cols-2/);
  assert.match(detailPage, /inline-flex rounded-full border border-zinc-200\/70 bg-white\/70 px-3 py-2 text-xs font-semibold text-brand-600/);
  assert.doesNotMatch(detailPage, /border-gray-/);
  assert.doesNotMatch(detailPage, /bg-gray-/);
});

test("MOBILE-008 dissect mobile shell keeps input controls touch-friendly and constrains inline popovers", async () => {
  const pageSource = await readText("src/app/dissect/page.tsx");
  const clientSource = await readText("src/app/dissect/DissectorClient.tsx");

  assert.match(pageSource, /<main className="min-h-screen bg-app">/);
  assert.doesNotMatch(pageSource, /text-gray-900/);

  assert.match(clientSource, /mx-auto w-full max-w-3xl px-4 pt-4 pb-\[calc\(3\.5rem\+env\(safe-area-inset-bottom\)\+16px\)\] sm:px-6 md:py-10/);
  assert.match(clientSource, /mb-6 md:mb-8/);
  assert.match(clientSource, /text-2xl leading-snug md:text-3xl/);
  assert.match(clientSource, /min-h-\[112px\] md:min-h-\[96px\] w-full resize-y rounded-surface/);
  assert.match(clientSource, /flex flex-wrap items-center gap-3/);
  assert.match(clientSource, /flex-1 sm:flex-none/);
  assert.match(clientSource, /py-3 md:py-2\.5/);
  assert.match(clientSource, /active:scale-\[0\.98\] md:active:scale-100/);
  assert.match(clientSource, /rounded-surface border border-zinc-200\/50/);
  assert.match(clientSource, /w-\[min\(20rem,calc\(100vw-2rem\)\)\] max-w-sm/);
  assert.match(clientSource, /w-\[min\(18rem,calc\(100vw-2rem\)\)\] max-w-\[18rem\]/);
  assert.match(clientSource, /text-zinc-400 dark:text-zinc-500 md:hidden/);
  assert.doesNotMatch(clientSource, /text-gray-/);
});
