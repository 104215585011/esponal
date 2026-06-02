import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("MOBILE-002 design and ticket are present", async () => {
  assert.equal(existsSync("docs/tickets/MOBILE-002.md"), true);
  assert.equal(existsSync("docs/tickets/MOBILE-002-design.md"), true);

  const design = await readText("docs/tickets/MOBILE-002-design.md");
  assert.match(design, /底部控制条/);
  assert.match(design, /不做双语对照/);
  assert.match(design, /连续朗读:纳入本票/);
});

test("MOBILE-002 article shell hides top read status on mobile only", async () => {
  const page = await readText("src/app/lectura/[slug]/page.tsx");

  assert.match(page, /<div className="hidden md:block">\s*\{userId \? <LecturaReadStatus isRead=\{isRead\} slug=\{story\.slug\} \/> : null\}\s*<\/div>/s);
  assert.match(page, /<article className="mx-auto max-w-3xl px-5 pb-32 pt-6 md:px-6 md:pt-10">/);
});

test("MOBILE-002 reader typography and desktop-only preferences are responsive", async () => {
  const reader = await readText("src/app/lectura/LecturaReader.tsx");

  assert.match(reader, /sm:\s*"text-\[16px\] leading-\[1\.75\] md:leading-\[1\.8\]"/);
  assert.match(reader, /md:\s*"text-\[18px\] leading-\[1\.85\]"/);
  assert.match(reader, /lg:\s*"text-\[19px\] leading-\[1\.9\] md:text-\[20px\]"/);
  assert.match(reader, /className="hidden md:flex justify-end mb-6"/);
  assert.match(reader, /className=\{`group mb-6 md:mb-8 flex md:gap-3 border-l-2 pl-3 md:pl-3\.5 transition/);
  assert.match(reader, /"border-brand-500 bg-brand-50\/40 dark:bg-brand-950\/20"/);
  assert.match(reader, /hidden md:flex md:opacity-0 md:group-hover:opacity-100/);
});

test("MOBILE-002 mobile reading bar is thumb reachable and hides under lookup sheet", async () => {
  const reader = await readText("src/app/lectura/LecturaReader.tsx");

  assert.match(reader, /function MobileReadingBar/);
  assert.match(reader, /if \(activeLookup\) return null;/);
  assert.match(reader, /aria-label="阅读控制"/);
  assert.match(reader, /fixed inset-x-4 bottom-\[calc\(env\(safe-area-inset-bottom\)\+12px\)\] z-30/);
  assert.match(reader, /rounded-full border border-zinc-200\/60 bg-white\/80/);
  assert.match(reader, /dark:border-zinc-800\/60 dark:bg-zinc-900\/80 md:hidden/);
  assert.match(reader, /aria-label=\{`字号：\$\{fontSizeLabels\[fontSize\]\}`\}/);
  assert.match(reader, /SkipBack/);
  assert.match(reader, /SkipForward/);
  assert.match(reader, /Check/);
  assert.match(reader, /bg-brand-500 text-white shadow-md shadow-brand-500\/25/);
});

test("MOBILE-002 mobile controls cycle size, auto-continue audio, and mark read", async () => {
  const reader = await readText("src/app/lectura/LecturaReader.tsx");

  assert.match(reader, /const cycleFontSize = \(\) =>/);
  assert.match(reader, /fontSize === "sm" \? "md" : fontSize === "md" \? "lg" : "sm"/);
  assert.match(reader, /playParagraphAudio\(paragraphIndex \+ 1\)/);
  assert.match(reader, /playPreviousParagraph/);
  assert.match(reader, /playNextParagraph/);
  assert.match(reader, /onMarkAsRead=\{markAsRead\}/);
  assert.match(reader, /disabled=\{isMarked\}/);
});
