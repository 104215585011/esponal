import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

async function readText(path) {
  return await readFile(path, "utf8");
}

test("MOBILE-000 LookupCardStack adds a mobile portal bottom sheet while preserving desktop stack", async () => {
  const source = await readText("src/app/watch/LookupCard.tsx");

  assert.match(source, /createPortal/);
  assert.match(source, /document\.body/);
  assert.match(source, /md:hidden/);
  assert.match(source, /fixed inset-0 z-50 flex flex-col justify-end/);
  assert.match(source, /bg-black\/45 backdrop-blur-\[1px\]/);
  assert.match(source, /max-h-\[75vh\]/);
  assert.match(source, /rounded-t-2xl/);
  assert.match(source, /pb-\[calc\(env\(safe-area-inset-bottom\)\+12px\)\]/);
  assert.match(source, /useStaticLayout=\{true\}/);
  assert.match(source, /const isMobileViewport = useIsMobileViewport\(\)/);
  assert.match(source, /if \(!activeCard \|\| isMobileViewport === null\) \{\s*return null;\s*\}/);
  assert.match(source, /if \(isMobileViewport\) \{/);

  assert.doesNotMatch(source, /hidden md:block relative w-full min-h-\[360px\]/);
  assert.match(source, /cards\.slice\(-2\)/);
  assert.match(source, /scale-\[0\.96\] -translate-y-3 opacity-40 blur-\[0\.5px\]/);
});

test("MOBILE-000 LookupCard mobile sheet supports touch-friendly close and content scrolling", async () => {
  const source = await readText("src/app/watch/LookupCard.tsx");

  assert.match(source, /aria-label="Close lookup sheet"/);
  assert.match(source, /onPointerDown/);
  assert.match(source, /onPointerUp/);
  assert.match(source, /overflow-y-auto/);
  assert.match(source, /px-5 pb-4/);
  assert.match(source, /min-h-\[44px\]/);
});

test("MOBILE-000 visual polish uses generated Tailwind-safe icon sizes", async () => {
  const source = await readText("src/app/watch/LookupCard.tsx");

  assert.match(source, /h-\[18px\] w-\[18px\]/);
  assert.match(source, /h-\[26px\] w-\[26px\]/);
  assert.doesNotMatch(source, /[hw]-4\.5/);
  assert.doesNotMatch(source, /[hw]-6\.5/);
});

test("MOBILE-000 mobile navigation uses 44px touch targets and the approved drawer width", async () => {
  const mobileNav = await readText("src/app/components/web/MobileNav.tsx");
  const siteHeader = await readText("src/app/components/web/SiteHeader.tsx");

  assert.match(mobileNav, /h-11 w-11/);
  assert.match(mobileNav, /w-72/);
  assert.match(mobileNav, /bg-black\/35[\s\S]*backdrop-blur-\[1px\]/);
  assert.match(mobileNav, /duration-300 ease-out/);
  assert.match(mobileNav, /py-3\.5 px-6/);
  assert.match(mobileNav, /text-base font-semibold/);
  assert.match(mobileNav, /min-h-\[44px\]/);

  assert.match(siteHeader, /h-16/);
  assert.match(siteHeader, /px-4 sm:px-6/);
});

test("MOBILE-000 global mobile tokens expose safe-area and touch-target utilities", async () => {
  const globals = await readText("src/app/globals.css");

  assert.match(globals, /\.pb-safe/);
  assert.match(globals, /padding-bottom: env\(safe-area-inset-bottom, 0px\)/);
  assert.match(globals, /\.mobile-touch-target/);
  assert.match(globals, /min-height: 44px/);
  assert.match(globals, /min-width: 44px/);
});
