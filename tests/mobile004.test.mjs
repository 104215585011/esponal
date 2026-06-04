// Timestamp: 2026-06-04 10:37
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const readText = (filePath) => readFile(filePath, "utf8");

test("MOBILE-004 learn overview follows the approved mockup structure on mobile", async () => {
  const source = await readText("src/app/learn/page.tsx");

  assert.match(source, /pb-\[calc\(3\.5rem\+env\(safe-area-inset-bottom\)\+16px\)\]/);
  assert.match(source, /pt-5/);
  assert.match(source, /md:py-10/);
  assert.match(source, /<div className="md:hidden">[\s\S]*9 个单元/);
  assert.match(source, /kickerDot/);
  assert.match(source, /text-\[27px\] font-bold leading-\[1\.36\]/);
  assert.match(source, /mt-\[18px\] grid grid-cols-3 gap-\[10px\]/);
  assert.match(source, /rounded-\[14px\] border border-zinc-200\/70 bg-white px-\[14px\] py-\[13px\]/);
  assert.match(source, /mt-\[22px\] flex items-center gap-\[14px\] rounded-\[20px\]/);
  assert.match(source, /mt-\[34px\] px-\[22px\]/);
  assert.match(source, /mt-\[14px\] flex flex-col gap-\[11px\] px-\[22px\]/);
  assert.match(source, /h-\[44px\] w-\[44px\] rounded-\[13px\]/);
  assert.match(source, /className="mt-\[36px\] px-\[22px\] text-\[11px\]/);
  assert.match(source, /className="hidden md:block">[\s\S]*Esponal Curriculum/);
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
