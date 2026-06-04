// Timestamp: 2026-06-04 10:53
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const readText = (filePath) => readFile(filePath, "utf8");

test("MOBILE-003 design reset is the approved clean modern homepage direction", async () => {
  const design = await readText("docs/tickets/MOBILE-003-design.md");
  const mockup = await readText("docs/tickets/MOBILE-003-mockup.html");

  assert.match(design, /v2 实现基准/);
  assert.match(design, /MOBILE-003-mockup\.html/);
  assert.match(design, /去掉精选视频区/);
  assert.match(design, /Hero\(纯白\/大标题\/听懂翡翠\/翡翠CTA\)/);
  assert.match(mockup, /--brand:#10b981/);
  assert.match(mockup, /\.rail\{[\s\S]*overflow-x:auto/);
});

test("MOBILE-003 hero is lightweight on mobile and restores the old desktop hero rhythm", async () => {
  const source = await readText("src/app/components/web/HomeHero.tsx");

  assert.match(source, /md:min-h-\[460px\]/);
  assert.match(source, /md:p-16/);
  assert.match(source, /md:mb-16/);
  assert.match(source, /hidden md:block[\s\S]*<ParticleBackground \/>/);
  assert.match(source, /text-\[33px\]/);
  assert.match(source, /md:text-6xl/);
  assert.match(source, /bg-brand-500/);
  assert.match(source, /rounded-\[14px\]/);
  assert.match(source, /className="hidden[\s\S]*md:inline-flex[\s\S]*href="#tools"/);
  assert.doesNotMatch(source, /min-h-\[460px\] flex items-center p-8 sm:p-16 mb-16/);
});

test("MOBILE-003 homepage uses mobile stats and a horizontal learning rail", async () => {
  const source = await readText("src/app/page.tsx");

  assert.match(source, /Timestamp: 2026-06-04 10:53/);
  assert.match(source, /grid grid-cols-2 overflow-hidden rounded-\[16px\]/);
  assert.match(source, /stats\?\.totalSaved \?\? 119/);
  assert.match(source, /readCount \?\? 4/);
  assert.match(source, /-mx-4 flex snap-x gap-3 overflow-x-auto px-4/);
  assert.match(source, /flex-none basis-\[195px\] snap-start/);
  assert.match(source, /md:flex-1/);
  assert.match(source, /md:min-h-\[220px\]/);
  assert.match(source, /hidden h-3\.5 w-3\.5 -rotate-90 shrink-0 md:inline/);
  assert.match(source, /md:hidden/);
});

test("MOBILE-003 hides duplicate mobile tools and keeps video only as a hidden legacy marker", async () => {
  const source = await readText("src/app/page.tsx");

  assert.match(source, /id="tools"/);
  assert.match(source, /<section className="mt-16 hidden[\s\S]*md:block" id="tools"/);
  assert.match(source, /curatedChannels/);
  assert.match(source, /id="video-sections" className="hidden"/);
  assert.doesNotMatch(source, /fetchChannelVideos\(checkCuratedChannels/);
  assert.doesNotMatch(source, /<VideoCard/);
});
