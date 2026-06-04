// Timestamp: 2026-06-04 10:37
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const readText = (filePath) => readFile(filePath, "utf8");

test("MOBILE-004 learn overview uses mobile-safe spacing and compact scan cards", async () => {
  const source = await readText("src/app/learn/page.tsx");

  assert.match(source, /pb-\[calc\(3\.5rem\+env\(safe-area-inset-bottom\)\+16px\)\]/);
  assert.match(source, /pt-5/);
  assert.match(source, /md:py-10/);
  assert.match(source, /px-5 py-6 text-white shadow-card/);
  assert.match(source, /line-clamp-3 md:line-clamp-none/);
  assert.match(source, /mt-7 grid grid-cols-1 gap-3 md:mt-8 md:grid-cols-2 md:gap-5 xl:grid-cols-3/);
  assert.match(source, /active:scale-\[0\.99\]/);
  assert.match(source, /md:rounded-hero md:p-5 md:card-hover-lift md:active:scale-100/);
  assert.match(source, /mt-5 hidden flex-wrap gap-2 md:flex/);
  assert.match(source, /hidden md:flex/);
  assert.match(source, /line-clamp-1 md:line-clamp-none/);
});

test("MOBILE-004 learn detail adds mobile anchor chips and safe-area spacing", async () => {
  const source = await readText("src/app/learn/[slug]/page.tsx");

  assert.match(source, /pb-\[calc\(3\.5rem\+env\(safe-area-inset-bottom\)\+16px\)\]/);
  assert.match(source, /pt-4/);
  assert.match(source, /md:py-8/);
  assert.match(source, /aria-label="章节导航"/);
  assert.match(source, /-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1/);
  assert.match(source, /lg:hidden/);
  assert.match(source, /rounded-full border border-zinc-200\/70 bg-white\/70 px-3\.5 py-2/);
  assert.match(source, /active:scale-95/);
});

test("MOBILE-004 learn detail stacks phrases on mobile and restores desktop columns", async () => {
  const source = await readText("src/app/learn/[slug]/page.tsx");

  assert.match(source, /flex flex-col gap-2 py-4 md:grid md:grid-cols-\[1\.1fr_1fr_auto\] md:gap-3 md:items-center/);
  assert.match(source, /flex items-start justify-between gap-3 md:contents/);
  assert.match(source, /shrink-0 md:order-last md:justify-self-end/);
  assert.match(source, /space-y-5 md:space-y-6/);
  assert.match(source, /p-4[\s\S]*md:p-6/);
  assert.match(source, /p-4[\s\S]*md:p-5/);
});

test("MOBILE-004 removes sky accents from learn detail compare and speaker-b surfaces", async () => {
  const source = await readText("src/app/learn/[slug]/page.tsx");

  assert.match(source, /bg-zinc-100 dark:bg-zinc-800\/60 text-zinc-600 dark:text-zinc-300/);
  assert.match(source, /text-zinc-500 dark:text-zinc-400 font-display">Compare/);
  assert.match(source, /border-zinc-200\/50[\s\S]*bg-zinc-50\/70[\s\S]*dark:border-zinc-800\/50[\s\S]*dark:bg-zinc-900\/40/);
  assert.match(source, /\[\&_td\]:border-zinc-200/);
  assert.match(source, /\[\&_th\]:border-zinc-200/);
  assert.doesNotMatch(source, /bg-sky-100/);
  assert.doesNotMatch(source, /text-sky-700/);
  assert.doesNotMatch(source, /border-sky-100/);
});

test("MOBILE-004 foundation overview gets mobile-safe padding and touch feedback", async () => {
  const source = await readText("src/app/learn/foundation/page.tsx");

  assert.match(source, /pb-\[calc\(3\.5rem\+env\(safe-area-inset-bottom\)\+16px\)\]/);
  assert.match(source, /pt-5/);
  assert.match(source, /md:py-10/);
  assert.match(source, /p-5[\s\S]*md:p-6/);
  assert.match(source, /transition-transform[\s\S]*active:scale-\[0\.99\][\s\S]*md:active:scale-100/);
});
