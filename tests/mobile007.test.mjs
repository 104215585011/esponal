// Timestamp: 2026-06-04 10:37
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readText(path) {
  return readFileSync(path, "utf8");
}

test("MOBILE-007 page shell reserves mobile tab space and keeps desktop rhythm", () => {
  const page = readText("src/app/phonics/page.tsx");

  assert.match(page, /Timestamp: 2026-06-04/);
  assert.match(page, /pt-4/);
  assert.match(page, /pb-\[calc\(3\.5rem\+env\(safe-area-inset-bottom\)\+16px\)\]/);
  assert.match(page, /md:py-10/);
  assert.match(page, /mb-6 md:mb-8/);
  assert.match(page, /text-2xl/);
  assert.match(page, /sm:text-4xl/);
  assert.match(page, /md:text-5xl/);
  assert.match(page, /border-zinc-100/);
  assert.doesNotMatch(page, /border-gray-100/);
});

test("MOBILE-007 alphabet grid uses compact mobile cards with separate rule drawer trigger", () => {
  const grid = readText("src/app/phonics/AlphabetGrid.tsx");

  assert.match(grid, /Timestamp: 2026-06-04/);
  assert.match(grid, /import \{ ChevronRight, Volume2 \} from "lucide-react"/);
  assert.match(grid, /grid-cols-4 gap-2 sm:grid-cols-4 sm:gap-4 lg:grid-cols-5/);
  assert.match(grid, /md:hidden/);
  assert.match(grid, /hidden md:flex/);
  assert.match(grid, /aspect-square/);
  assert.match(grid, /active:scale-\[0\.97\]/);
  assert.match(grid, /onClick=\{\(\) => play\(`\/audio\/phonics\/letters\/\$\{letter\.slug\}\.mp3`, letterKey\)\}/);
  assert.match(grid, /event\.stopPropagation\(\)/);
  assert.match(grid, /setSelectedLetter\(letter\)/);
  assert.match(grid, /<ChevronRight/);
  assert.match(grid, /ring-2 ring-brand-400/);
  assert.match(grid, /right-1\.5 top-1\.5 h-1\.5 w-1\.5/);
  assert.doesNotMatch(grid, /animate-pulse/);
  assert.doesNotMatch(grid, /馃攰/);
});

test("MOBILE-007 alphabet rule drawer has mobile safe area and scroll lock", () => {
  const grid = readText("src/app/phonics/AlphabetGrid.tsx");

  assert.match(grid, /useEffect/);
  assert.match(grid, /document\.body\.style\.overflow = "hidden"/);
  assert.match(grid, /document\.body\.style\.overflow = previousOverflow/);
  assert.match(grid, /mx-auto mt-3 mb-1 h-1 w-12 touch-none rounded-full bg-zinc-200/);
  assert.match(grid, /pb-\[calc\(env\(safe-area-inset-bottom\)\+20px\)\]/);
  assert.match(grid, /min-h-\[40px\]/);
  assert.match(grid, /sm:items-center/);
  assert.match(grid, /sm:rounded-card/);
});

test("MOBILE-007 alphabet rule drawer supports pull-down dismissal", () => {
  const grid = readText("src/app/phonics/AlphabetGrid.tsx");

  assert.match(grid, /dragStartYRef/);
  assert.match(grid, /drawerOffset/);
  assert.match(grid, /handleDrawerPointerDown/);
  assert.match(grid, /handleDrawerPointerMove/);
  assert.match(grid, /handleDrawerPointerEnd/);
  assert.match(grid, /event\.clientY - dragStartYRef\.current/);
  assert.match(grid, /if \(drawerOffsetRef\.current > 80\)/);
  assert.match(grid, /setSelectedLetter\(null\)/);
  assert.match(grid, /style=\{\{ transform: `translateY\(\$\{drawerOffset\}px\)` \}\}/);
  assert.match(grid, /onPointerDown=\{handleDrawerPointerDown\}/);
  assert.match(grid, /onPointerMove=\{handleDrawerPointerMove\}/);
  assert.match(grid, /onPointerUp=\{handleDrawerPointerEnd\}/);
  assert.match(grid, /onPointerCancel=\{handleDrawerPointerCancel\}/);
});

test("MOBILE-007 intro chips are thumb-sized and use lucide audio icons", () => {
  const intro = readText("src/app/phonics/PhonicsIntro.tsx");

  assert.match(intro, /Timestamp: 2026-06-04/);
  assert.match(intro, /import \{ Volume2 \} from "lucide-react"/);
  assert.match(intro, /min-h-\[44px\]/);
  assert.match(intro, /md:h-9/);
  assert.match(intro, /gap-2\.5 md:gap-2/);
  assert.match(intro, /space-y-6 md:space-y-8/);
  assert.match(intro, /p-4 md:p-5/);
  assert.match(intro, /p-4 md:p-6/);
  assert.match(intro, /<Volume2/);
  assert.doesNotMatch(intro, /font-light font-light/);
  assert.doesNotMatch(intro, /馃攰/);
});

test("MOBILE-007 prosody is zinc based, dark-mode aware, and emoji free", () => {
  const prosody = readText("src/app/phonics/PhonicsProsody.tsx");

  assert.match(prosody, /Timestamp: 2026-06-04/);
  assert.match(prosody, /import \{ Volume2 \} from "lucide-react"/);
  assert.match(prosody, /mt-8 border-t border-zinc-100 pt-8/);
  assert.match(prosody, /dark:border-zinc-900/);
  assert.match(prosody, /space-y-6 md:space-y-8/);
  assert.match(prosody, /text-xl font-semibold tracking-tight text-zinc-950/);
  assert.match(prosody, /dark:text-zinc-50/);
  assert.match(prosody, /bg-zinc-50/);
  assert.match(prosody, /dark:bg-zinc-900\/60/);
  assert.match(prosody, /min-h-\[44px\]/);
  assert.match(prosody, /md:h-9/);
  assert.match(prosody, /<Volume2/);
  assert.doesNotMatch(prosody, /\bgray-/);
  assert.doesNotMatch(prosody, /馃攰/);
});
