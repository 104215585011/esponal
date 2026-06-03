// Timestamp: 2026-06-03 16:30
import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("MOBILE-003 keeps home redesign scoped away from shared mobile navigation", async () => {
  const page = await readText("src/app/page.tsx");
  const hero = await readText("src/app/components/web/HomeHero.tsx");

  assert.doesNotMatch(page, /BottomTabBar|MobileNav|MobileTopBar|SiteNav/);
  assert.doesNotMatch(hero, /BottomTabBar|MobileNav|MobileTopBar|SiteNav/);
});

test("MOBILE-003 compacts the mobile hero without regressing desktop scale", async () => {
  const hero = await readText("src/app/components/web/HomeHero.tsx");

  assert.match(hero, /min-h-\[240px\]/);
  assert.match(hero, /md:min-h-\[460px\]/);
  assert.match(hero, /p-6/);
  assert.match(hero, /sm:p-8/);
  assert.match(hero, /md:p-16/);
  assert.match(hero, /mb-8/);
  assert.match(hero, /md:mb-16/);
  assert.match(hero, /hidden md:block[\s\S]*<ParticleBackground \/>/);
  assert.match(hero, /md:hidden/);
  assert.match(hero, /text-\[26px\]/);
  assert.match(hero, /href=\{isLoggedIn \? "\/learn" : "\/phonics"\}/);
  assert.match(hero, /w-full[\s\S]*sm:w-auto/);
  assert.match(hero, /className="[^"]*hidden[^"]*sm:inline-flex[^"]*"[\s\S]*href="#tools"/);
});

test("MOBILE-003 turns the learning path into compact mobile snap cards", async () => {
  const page = await readText("src/app/page.tsx");

  assert.match(page, /pt-4 pb-\[calc\(3\.5rem\+env\(safe-area-inset-bottom\)\+16px\)\]/);
  assert.match(page, /md:pt-16 md:pb-16/);
  assert.match(page, /-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2/);
  assert.match(page, /md:mx-0 md:px-0 md:overflow-visible lg:flex-row/);
  assert.match(page, /<Link\s+className="group glass-card md:card-hover-lift flex min-h-\[150px\] w-\[140px\] shrink-0 snap-start flex-col/);
  assert.match(page, /md:min-h-\[220px\]/);
  assert.match(page, /md:w-auto md:min-w-0 md:flex-1 md:p-6/);
  assert.match(page, /active:scale-\[0\.98\]/);
  assert.match(page, /className="hidden h-3\.5 w-3\.5 -rotate-90 shrink-0 md:block"/);
});

test("MOBILE-003 hides duplicate tools on mobile and renders real curated videos", async () => {
  const page = await readText("src/app/page.tsx");

  assert.match(page, /id="tools"/);
  assert.match(page, /className="mt-16 hidden border-t/);
  assert.match(page, /const selectedChannel = curatedChannels\[0\]/);
  assert.match(page, /fetchChannelVideos\(selectedChannel\.id, 8\)/);
  assert.match(page, /id="video-sections"/);
  assert.match(page, /selectedVideos\.map/);
  assert.match(page, /<VideoCard video=\{video\} \/>/);
  assert.match(page, /href="\/watch"/);
});
