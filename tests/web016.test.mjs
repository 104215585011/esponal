import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("WEB-016 watch page uses fixed desktop columns", async () => {
  const page = await readText("src/app/watch/page.tsx");

  assert.match(page, /lg:basis-\[48rem\]/);
  assert.match(page, /lg:shrink-0/);
  assert.doesNotMatch(page, /lg:basis-\[63%\]|lg:basis-\[51rem\]/);
  assert.match(page, /lg:max-w-\[48rem\]/);
  assert.doesNotMatch(page, /lg:mx-auto/);
  assert.match(page, /<aside className="hidden border-l border-gray-200 bg-surface lg:flex lg:w-\[260px\] lg:shrink-0">/);
  assert.doesNotMatch(page, /<div className="hidden lg:block">\s*<RelatedPanel/);
});

test("WEB-016 mobile watch layout keeps transcript height and hides related videos", async () => {
  const page = await readText("src/app/watch/page.tsx");

  assert.match(page, /h-\[60vh\] min-w-0 border-t border-gray-200 bg-surface/);
  assert.match(page, /<aside className="hidden border-l border-gray-200 bg-surface lg:flex/);
});

test("WEB-016 related panel removes hover and pin state machine", async () => {
  const panel = await readText("src/app/watch/RelatedPanel.tsx");

  assert.doesNotMatch(panel, /useState|useRef|useEffect/);
  assert.doesNotMatch(panel, /scheduleOpen|scheduleClose|clearTimers|showTimerRef|hideTimerRef/);
  assert.doesNotMatch(panel, /translate-x-full|translate-x-0|absolute bottom-0 right-0/);
  assert.doesNotMatch(panel, /pinned|setPinned|visible|setVisible/);
});

test("WEB-016 related panel uses compact 260px-column card density", async () => {
  const panel = await readText("src/app/watch/RelatedPanel.tsx");

  assert.match(panel, /px-2 py-2/);
  assert.match(panel, /px-2 py-1\.5/);
  assert.match(panel, /h-\[54px\] w-\[96px\]/);
  assert.doesNotMatch(panel, /h-\[60px\] w-\[108px\]/);
});
