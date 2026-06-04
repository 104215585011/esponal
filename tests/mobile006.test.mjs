// Timestamp: 2026-06-04 14:34
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const readText = (filePath) => readFile(filePath, "utf8");

test("MOBILE-006 talk list swaps to MobileTopBar on mobile and compact horizontal cards", async () => {
  const source = await readText("src/app/talk/page.tsx");

  assert.match(source, /getServerSession/);
  assert.match(source, /getAuthOptions/);
  assert.match(source, /MobileTopBar/);
  assert.match(source, /hidden md:block"><SiteHeader/);
  assert.match(source, /font-display text-2xl font-semibold tracking-tight/);
  assert.match(source, /grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-5 lg:grid-cols-3/);
  assert.match(source, /rounded-hero border border-zinc-200\/60 bg-white\/70 p-4/);
  assert.match(source, /rounded-full bg-brand-50/);
  assert.match(source, /md:flex-col/);
  assert.match(source, /line-clamp-2/);
  assert.match(source, /hidden text-\[11px\][\s\S]*md:block/);
  assert.match(source, /active:scale-\[0\.99\]/);
});

test("MOBILE-006 talk list has readable Chinese copy and stable text avatar badges", async () => {
  const source = await readText("src/app/talk/page.tsx");

  assert.match(source, /选择一位 AI 老师/);
  assert.match(source, /用真人感的对话练口语/);
  assert.match(source, /推荐/);
  assert.match(source, /LANG_BADGE/);
  assert.match(source, /carlos: "ES"/);
  assert.match(source, /emma: "UK"/);
  assert.match(source, /jake: "US"/);
  assert.match(source, /sophie: "FR"/);
  assert.match(source, /kenji: "JP"/);
  assert.doesNotMatch(source, /棣冨福/);
  assert.doesNotMatch(source, /鏃犳硶/);
});

test("MOBILE-006 talk detail uses a mobile back header with avatar accent and 100dvh shell", async () => {
  const pageSource = await readText("src/app/talk/[characterId]/page.tsx");
  const shellSource = await readText("src/app/talk/[characterId]/TalkCharacterShell.tsx");

  assert.match(shellSource, /fixed inset-x-0 top-0 z-50 grid h-\[52px\] grid-cols-\[44px_1fr_44px\]/);
  assert.match(shellSource, /router\.push\("\/talk"\)/);
  assert.match(shellSource, /h-\[calc\(100dvh-52px\)\] md:h-\[calc\(100vh-64px\)\]/);
  assert.match(shellSource, /pt-\[52px\] md:pt-0/);
  assert.match(shellSource, /rounded-full bg-brand-50/);
  assert.match(shellSource, /h-\[11px\] w-\[11px\] rounded-full bg-brand-500/);
  assert.match(shellSource, /hidden md:block"><SiteHeader/);
  assert.match(shellSource, /BackLink href="\/talk" label=/);
  assert.match(pageSource, /TalkCharacterShell/);
});

test("MOBILE-006 TalkSidebar moves to md breakpoint and mobile drawer sits above header", async () => {
  const source = await readText("src/app/talk/[characterId]/TalkSidebar.tsx");

  assert.match(source, /open\?: boolean/);
  assert.match(source, /onOpenChange\?: \(open: boolean\) => void/);
  assert.match(source, /hidden h-full md:block/);
  assert.match(source, /fixed inset-0 z-\[60\] flex md:hidden/);
  assert.match(source, /w-\[82vw\] max-w-sm/);
  assert.match(source, /pt-\[calc\(env\(safe-area-inset-top\)\+8px\)\]/);
  assert.match(source, /h-11 md:h-9/);
  assert.match(source, /z-\[70\]/);
  assert.doesNotMatch(source, /lg:hidden/);
});

test("MOBILE-006 TalkClient uses day pill, mini avatar, safe-area composer, and svg icons", async () => {
  const source = await readText("src/app/talk/[characterId]/TalkClient.tsx");

  assert.match(source, /inline-flex rounded-full bg-black\/\[0\.04\] px-3 py-1 text-\[10\.5px\]/);
  assert.match(source, /flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50/);
  assert.match(source, /space-y-3 overflow-y-auto overscroll-contain px-4 py-4/);
  assert.match(source, /border-t border-zinc-100 bg-white\/85 backdrop-blur-xl/);
  assert.match(source, /pb-\[calc\(env\(safe-area-inset-bottom\)\+10px\)\]/);
  assert.match(source, /min-h-\[44px\] max-h-32 flex-1 resize-none rounded-\[22px\]/);
  assert.match(source, /aria-label=\{recording \? "\\u505c\\u6b62\\u5f55\\u97f3" : "\\u5f00\\u59cb\\u8bed\\u97f3\\u8f93\\u5165"\}/);
  assert.match(source, /aria-label="\\u53d1\\u9001"/);
  assert.match(source, /viewBox="0 0 24 24">\s*<rect x="6" y="6" width="12" height="12" rx="2"/);
  assert.match(source, /viewBox="0 0 24 24">\s*<rect x="9" y="2" width="6" height="12" rx="3"/);
  assert.match(source, /viewBox="0 0 24 24"[\s\S]*<path d="M12 19V5M5 12l7-7 7 7"/);
  assert.match(source, /\\u5bf9\\u65b9\\u6b63\\u5728\\u8f93\\u5165/);
  assert.match(source, /\\u5f00\\u59cb\\u5bf9\\u8bdd\\u5427/);
  assert.doesNotMatch(source, /棣冨福/);
  assert.doesNotMatch(source, /鏃犳硶/);
});
