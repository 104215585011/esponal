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

  assert.match(source, /min-h-\[240px\]/);
  assert.match(source, /md:min-h-\[460px\]/);
  assert.match(source, /md:p-16/);
  assert.match(source, /md:mb-16/);
  assert.match(source, /hidden md:block[\s\S]*<ParticleBackground \/>/);
  assert.match(source, /px-\[22px\]/);
  assert.match(source, /pt-\[30px\]/);
  assert.match(source, /pb-1/);
  assert.match(source, /text-\[13px\]/);
  assert.match(source, /text-\[33px\]/);
  assert.match(source, /leading-\[1\.32\]/);
  assert.match(source, /max-w-\[300px\]/);
  assert.match(source, /text-sm font-light leading-\[1\.8\]/);
  assert.match(source, /md:text-6xl/);
  assert.match(source, /bg-brand-500/);
  assert.match(source, /rounded-\[14px\]/);
  assert.match(source, /px-\[24px\] py-\[13px\]/);
  assert.match(source, /shadow-\[0_8px_20px_-8px_rgba\(16,185,129,0\.5\)\]/);
  assert.match(source, /h-1\.5 w-1\.5 rounded-full bg-brand-500 shadow-\[0_0_0_4px_rgba\(16,185,129,0\.12\)\]/);
  assert.match(source, /className="hidden[\s\S]*md:inline-flex[\s\S]*href="#tools"/);
  assert.doesNotMatch(source, /min-h-\[460px\] flex items-center p-8 sm:p-16 mb-16/);
});

test("MOBILE-003 homepage uses mockup-style mobile stats and a horizontal learning rail", async () => {
  const source = await readText("src/app/page.tsx");

  assert.match(source, /Timestamp: 2026-06-04 10:53|Timestamp: 2026-06-04 11:|Timestamp: 2026-06-04 12:/);
  assert.match(source, /mt-\[38px\] md:mt-16/);
  assert.match(source, /mx-\[22px\] mt-\[24px\] flex overflow-hidden rounded-\[16px\] border border-zinc-200\/70 bg-white/);
  assert.match(source, /px-4 py-\[14px\]/);
  assert.match(source, /stats\?\.totalSaved \?\? 119/);
  assert.match(source, /readCount \?\? 4/);
  assert.match(source, /-mx-4 mt-\[18px\] flex snap-x snap-mandatory gap-\[13px\] overflow-x-auto px-\[22px\] pb-2/);
  assert.match(source, /flex-none basis-\[195px\] snap-start/);
  assert.match(source, /rounded-\[20px\] border border-zinc-200\/70 bg-white p-\[18px\] shadow-card/);
  assert.match(source, /grid h-\[38px\] w-\[38px\] place-items-center rounded-\[12px\] bg-brand-50/);
  assert.match(source, /min-h-\[55px\] text-\[12\.5px\] font-light leading-\[1\.7\]/);
  assert.match(source, /rounded-full bg-brand-50 px-\[9px\] py-1 text-\[11px\] font-semibold text-brand-600/);
  assert.match(source, /border-t border-zinc-100 pt-\[14px\] text-\[12\.5px\] font-semibold/);
  assert.match(source, /const mobileLearningSteps = allLearningSteps\.slice\(0, 3\)/);
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

test("MOBILE-003 shared shell visual polish follows the mockup glass treatment without changing structure", async () => {
  const topBar = await readText("src/app/components/web/MobileTopBar.tsx");
  const tabBar = await readText("src/app/components/web/BottomTabBar.tsx");

  assert.match(topBar, /bg-white\/78/);
  assert.match(topBar, /backdrop-blur-\[16px\]/);
  assert.match(topBar, /border-b border-zinc-200\/60/);
  assert.match(topBar, /px-5/);
  assert.match(topBar, /h-\[52px\]/);

  assert.match(tabBar, /bg-white\/90/);
  assert.match(tabBar, /backdrop-blur-\[18px\]/);
  assert.match(tabBar, /border-t border-zinc-200\/60/);
  assert.match(tabBar, /px-2 pt-\[9px\] pb-\[calc\(9px\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(tabBar, /text-\[10\.5px\]/);
  assert.match(tabBar, /text-brand-700/);
});
