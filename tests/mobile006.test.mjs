// Timestamp: 2026-06-04 10:37
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
  assert.match(source, /grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-5 lg:grid-cols-3/);
  assert.match(source, /md:flex-col/);
  assert.match(source, /line-clamp-2/);
  assert.match(source, /hidden text-\[11px\][\s\S]*md:block/);
  assert.match(source, /active:scale-\[0\.99\]/);
});

test("MOBILE-006 talk detail uses a mobile back header and 100dvh shell", async () => {
  const pageSource = await readText("src/app/talk/[characterId]/page.tsx");
  const shellSource = await readText("src/app/talk/[characterId]/TalkCharacterShell.tsx");

  assert.match(shellSource, /fixed inset-x-0 top-0 z-50 grid h-\[52px\] grid-cols-\[44px_1fr_44px\]/);
  assert.match(shellSource, /router\.push\("\/talk"\)/);
  assert.match(shellSource, /h-\[calc\(100dvh-52px\)\] md:h-\[calc\(100vh-64px\)\]/);
  assert.match(shellSource, /pt-\[52px\] md:pt-0/);
  assert.match(shellSource, /hidden md:block"><SiteHeader/);
  assert.match(shellSource, /<div className="hidden md:block">[\s\S]*<BackLink href="\/talk" label="对话" \/>/);
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

test("MOBILE-006 TalkClient uses bottom safe-area composer and svg icons instead of emoji", async () => {
  const source = await readText("src/app/talk/[characterId]/TalkClient.tsx");

  assert.match(source, /space-y-3 overflow-y-auto overscroll-contain px-4 py-4/);
  assert.match(source, /border-t border-zinc-100 bg-white\/85 backdrop-blur-xl/);
  assert.match(source, /pb-\[calc\(env\(safe-area-inset-bottom\)\+10px\)\]/);
  assert.match(source, /min-h-\[44px\] max-h-32 flex-1 resize-none rounded-\[22px\]/);
  assert.match(source, /aria-label=\{recording \? "停止录音" : "开始语音输入"\}/);
  assert.match(source, /aria-label="发送"/);
  assert.match(source, /viewBox="0 0 24 24">\s*<rect x="6" y="6" width="12" height="12" rx="2"/);
  assert.match(source, /viewBox="0 0 24 24">\s*<rect x="9" y="2" width="6" height="12" rx="3"/);
  assert.match(source, /viewBox="0 0 24 24"[\s\S]*<path d="M12 19V5M5 12l7-7 7 7"/);
  assert.doesNotMatch(source, /🎙/);
  assert.doesNotMatch(source, /■/);
  assert.doesNotMatch(source, /⬆/);
});
